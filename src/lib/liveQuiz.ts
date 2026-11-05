import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { closestGuessers, pointsForRight, pointsForWrong, rankTeams, tiedForFirst } from "@/lib/liveScoring";
import { ANSWER_MS, type HostAction, type LiveQueueItem, type LiveState, type LiveTeamState } from "@/lib/liveTypes";

// The brain of a live quiz night. Every change happens inside one database
// transaction and bumps `version`, so the projector and the phones only ask for
// the full picture when something has actually changed.

const answerDeadline = () => new Date(Date.now() + ANSWER_MS); // when the team that is answering runs out of time

const CELEBRATE_MS = 4500; // how long the "correct" animation runs before the next question
const REVEAL_MS = 5000; // how long the answer stays up when nobody got it

type Tx = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string };
type Done<T = object> = { ok: true } & T;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const fail = (error: string, status = 409): Fail => ({ ok: false, status, error });

const quizInclude = {
  rounds: { orderBy: { order: "asc" as const }, include: { questions: { orderBy: { order: "asc" as const } } } },
};
type FullQuiz = Prisma.LiveQuizGetPayload<{ include: typeof quizInclude }>;

// A quiz never changes after it is imported (a new import is a new quiz), so each server instance reads it once
// instead of on every poll.
const quizCache = new Map<string, FullQuiz>();

async function loadQuiz(db: Tx, quizId: string): Promise<FullQuiz> {
  const hit = quizCache.get(quizId);
  if (hit) return hit;
  const quiz = await db.liveQuiz.findUniqueOrThrow({ where: { id: quizId }, include: quizInclude });
  quizCache.set(quizId, quiz);
  return quiz;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L or O: they look like numbers

function randomCode(): string {
  return Array.from(randomBytes(4), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join("");
}

export async function createSession(quizId: string) {
  for (let i = 0; i < 10; i++) {
    try {
      return await prisma.liveSession.create({ data: { quizId, code: randomCode() } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw new Error("Couldn't make a join code");
}

export async function sessionIdForCode(code: string): Promise<string | null> {
  const s = await prisma.liveSession.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true } });
  return s?.id ?? null;
}

export async function currentVersion(sessionId: string): Promise<number | null> {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId }, select: { version: true } });
  return s?.version ?? null;
}

// What a poll needs to know, in ONE query: is there anything new? It also moves a timed phase on once its time is up.
export async function pollHead(where: { id: string } | { code: string }): Promise<{ id: string; version: number } | null> {
  const select = { id: true, version: true, phase: true, phaseUntil: true, status: true } as const;
  const key = "code" in where ? { code: where.code.trim().toUpperCase() } : where;
  let s = await prisma.liveSession.findUnique({ where: key, select });
  if (s && s.status === "active" && s.phaseUntil && s.phaseUntil.getTime() <= Date.now() && (s.phase === "celebrate" || s.phase === "reveal" || s.phase === "question")) {
    await tick(s.id);
    s = await prisma.liveSession.findUnique({ where: key, select });
  }
  return s ? { id: s.id, version: s.version } : null;
}

// Timed phases (the celebration, the revealed answer, a team's turn to answer) move on by themselves.
// Whoever asks first after the time is up moves it; the conditional update means it happens once.
export async function tick(sessionId: string): Promise<void> {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!s || s.status !== "active" || !s.phaseUntil || s.phaseUntil.getTime() > Date.now()) return;
  if (s.phase === "question") return passTurn(s);
  if (s.phase !== "celebrate" && s.phase !== "reveal") return;
  const quiz = await loadQuiz(prisma, s.quizId);
  const round = quiz.rounds[s.roundIdx];
  const more = round && s.pos + 1 < round.questions.length;
  await prisma.liveSession.updateMany({
    where: { id: s.id, phase: s.phase, version: s.version },
    data: more
      ? { phase: "question", pos: s.pos + 1, questionOpenedAt: new Date(), phaseUntil: null, version: { increment: 1 } }
      : { phase: "roundResults", phaseUntil: null, version: { increment: 1 } },
  });
}

// The team that is answering ran out of time: it counts as a skip (it costs what a wrong answer costs) and
// the next team in the queue is up. The quizmaster can undo it like any other skip.
async function passTurn(s: { id: string; quizId: string; roundIdx: number; pos: number }): Promise<void> {
  const quiz = await loadQuiz(prisma, s.quizId);
  const round = quiz.rounds[s.roundIdx];
  const question = round?.questions[s.pos];
  if (!round || !question) return;
  await prisma.$transaction(async (tx) => {
    const cur = await tx.liveSession.findUnique({ where: { id: s.id } });
    if (!cur || cur.status !== "active" || cur.phase !== "question" || !cur.phaseUntil || cur.phaseUntil.getTime() > Date.now()) return;
    const buzzes = await tx.liveBuzz.findMany({ where: { sessionId: s.id, questionId: question.id }, orderBy: { id: "asc" } });
    const answering = buzzes.find((b) => b.outcome === "pending");
    if (!answering) {
      await tx.liveSession.update({ where: { id: s.id }, data: { phaseUntil: null } });
      return;
    }
    // Claim the buzz first, so a tap from the quizmaster at the same moment can't score it twice.
    const claimed = await tx.liveBuzz.updateMany({ where: { id: answering.id, outcome: "pending" }, data: { outcome: "skipped" } });
    if (claimed.count === 0) return;
    const points = pointsForWrong({ rightPoints: round.rightPoints, wrongPenalty: round.wrongPenalty, placeDecay: round.placeDecay });
    await tx.liveScoreEvent.create({ data: { sessionId: s.id, teamId: answering.teamId, questionId: question.id, roundIdx: s.roundIdx, buzzId: answering.id, points, kind: "skipped" } });
    const next = buzzes.find((b) => b.id !== answering.id && b.outcome === "pending");
    await tx.liveSession.update({ where: { id: s.id }, data: { phaseUntil: next ? answerDeadline() : null, version: { increment: 1 } } });
  });
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

async function totalsByTeam(db: Tx, sessionId: string, roundIdx?: number): Promise<Map<string, number>> {
  const rows = await db.liveScoreEvent.groupBy({
    by: ["teamId"],
    where: { sessionId, undoneAt: null, ...(roundIdx === undefined ? {} : { roundIdx }) },
    _sum: { points: true },
  });
  return new Map(rows.map((r) => [r.teamId, r._sum.points ?? 0]));
}

function standingsOf(teams: { id: string; name: string }[], totals: Map<string, number>) {
  return rankTeams(teams.map((t) => ({ teamId: t.id, name: t.name, score: totals.get(t.id) ?? 0 })));
}

// ---------------------------------------------------------------------------
// Teams and buzzing (the phones)
// ---------------------------------------------------------------------------

export function cleanTeamName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export async function joinTeam(code: string, rawName: string, token: string): Promise<Done<{ team: { id: string; name: string } }> | Fail> {
  const name = cleanTeamName(rawName);
  if (name.length < 2 || name.length > 24) return fail("Pick a team name between 2 and 24 letters.", 400);
  if (token.length < 16) return fail("Something is wrong with this phone. Reload the page and try again.", 400);

  const session = await prisma.liveSession.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!session) return fail("We can't find that night. Check the code.", 404);
  if (session.status === "finished") return fail("This quiz night is over.");

  const tokenHash = hash(token);
  try {
    return await prisma.$transaction(async (tx) => {
      // One phone, one team: a phone that already has a team gets that team back.
      const mine = await tx.liveTeam.findUnique({ where: { sessionId_tokenHash: { sessionId: session.id, tokenHash } } });
      if (mine) return { ok: true as const, team: { id: mine.id, name: mine.name } };

      const sameName = await tx.liveTeam.findFirst({ where: { sessionId: session.id, name: { equals: name, mode: "insensitive" } } });
      if (sameName) {
        // A team the quizmaster released can be picked up by a new phone.
        if (sameName.tokenHash.startsWith("released:")) {
          await tx.liveTeam.update({ where: { id: sameName.id }, data: { tokenHash } });
          await tx.liveSession.update({ where: { id: session.id }, data: { version: { increment: 1 } } });
          return { ok: true as const, team: { id: sameName.id, name: sameName.name } };
        }
        return fail("That team already has a buzzer on another phone. Ask the quizmaster if that's you.");
      }

      const team = await tx.liveTeam.create({ data: { sessionId: session.id, name, tokenHash } });
      await tx.liveSession.update({ where: { id: session.id }, data: { version: { increment: 1 } } });
      return { ok: true as const, team: { id: team.id, name: team.name } };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("That team name or phone was just taken. Try again.");
    throw e;
  }
}

async function authTeam(db: Tx, code: string, teamId: string, token: string) {
  const session = await db.liveSession.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!session) return null;
  const team = await db.liveTeam.findFirst({ where: { id: teamId, sessionId: session.id, tokenHash: hash(token) } });
  return team ? { session, team } : null;
}

export async function buzz(code: string, teamId: string, token: string): Promise<Done<{ place: number }> | Fail> {
  await pollHead({ code });
  return prisma.$transaction(async (tx) => {
    const auth = await authTeam(tx, code, teamId, token);
    if (!auth) return fail("This phone isn't part of the quiz. Rejoin with your team name.", 403);
    const { session, team } = auth;
    if (session.phase !== "question" || session.status !== "active") return fail("The buzzer isn't open right now.");
    const quiz = await loadQuiz(tx, session.quizId);
    const q = quiz.rounds[session.roundIdx]?.questions[session.pos];
    if (!q) return fail("No question is open.");

    // One team, one buzz per question. A second tap (or a second phone) changes nothing.
    const existing = await tx.liveBuzz.findUnique({ where: { sessionId_questionId_teamId: { sessionId: session.id, questionId: q.id, teamId: team.id } } });
    if (!existing) {
      await tx.liveBuzz.create({ data: { sessionId: session.id, questionId: q.id, teamId: team.id } });
      // A team that buzzes into an empty queue is answering straight away, so its clock starts now.
      const waiting = await tx.liveBuzz.count({ where: { sessionId: session.id, questionId: q.id, outcome: "pending" } });
      await tx.liveSession.update({ where: { id: session.id }, data: { version: { increment: 1 }, ...(waiting === 1 ? { phaseUntil: answerDeadline() } : {}) } });
    }
    const all = await tx.liveBuzz.findMany({ where: { sessionId: session.id, questionId: q.id }, orderBy: { id: "asc" }, select: { teamId: true } });
    return { ok: true as const, place: all.findIndex((b) => b.teamId === team.id) };
  });
}

export async function submitGuess(code: string, teamId: string, token: string, value: number): Promise<Done | Fail> {
  if (!Number.isInteger(value) || value < 0 || value > 100000) return fail("Enter a whole number.", 400);
  return prisma.$transaction(async (tx) => {
    const auth = await authTeam(tx, code, teamId, token);
    if (!auth) return fail("This phone isn't part of the quiz.", 403);
    const { session, team } = auth;
    if (session.phase !== "tiebreak" || session.status !== "active") return fail("The tie-breaker isn't open.");
    if (!(session.tiedTeamIds ?? "").split(",").includes(team.id)) return fail("Only the teams in the tie play this one.");
    await tx.liveGuess.upsert({
      where: { sessionId_teamId: { sessionId: session.id, teamId: team.id } },
      create: { sessionId: session.id, teamId: team.id, value },
      update: { value },
    });
    await tx.liveSession.update({ where: { id: session.id }, data: { version: { increment: 1 } } });
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// The quizmaster's actions
// ---------------------------------------------------------------------------

export async function hostAction(sessionId: string, action: HostAction): Promise<Done | Fail> {
  await tick(sessionId);
  return prisma.$transaction(
    async (tx): Promise<Done | Fail> => {
      const s = await tx.liveSession.findUnique({ where: { id: sessionId } });
      if (!s) return fail("Session not found", 404);
      if (s.status === "finished" && action.type !== "setHide" && action.type !== "reopen" && action.type !== "showEnding" && !(action.type === "undo" && s.phase === "ending")) return fail("This night is finished. Reopen it to carry on.");
      const quiz = await loadQuiz(tx, s.quizId);
      const round = quiz.rounds[s.roundIdx];
      const question = round?.questions[s.pos] ?? null;
      const bump = (data: Prisma.LiveSessionUncheckedUpdateInput = {}) =>
        tx.liveSession.update({ where: { id: s.id }, data: { ...data, version: { increment: 1 } } });

      switch (action.type) {
        case "start": {
          if (s.phase !== "lobby") return fail("The night has already started.");
          if ((await tx.liveTeam.count({ where: { sessionId: s.id } })) < 1) return fail("At least one team has to join first.");
          await bump({ phase: "roundIntro", roundIdx: 0, pos: 0 });
          return { ok: true };
        }

        case "continue": {
          if (s.phase === "roundIntro") {
            if (!question) return fail("This round has no questions.");
            await bump({ phase: "question", questionOpenedAt: new Date(), phaseUntil: null });
            return { ok: true };
          }
          if (s.phase === "roundResults") {
            if (s.roundIdx + 1 < quiz.rounds.length) {
              await bump({ phase: "roundIntro", roundIdx: s.roundIdx + 1, pos: 0 });
              return { ok: true };
            }
            // Finished the last round: a tie for first goes to the tie-breaker.
            const teams = await tx.liveTeam.findMany({ where: { sessionId: s.id }, select: { id: true, name: true } });
            const tied = tiedForFirst(standingsOf(teams, await totalsByTeam(tx, s.id)));
            if (tied.length > 1 && quiz.tiebreakPrompt && quiz.tiebreakAnswer) {
              await bump({ phase: "tiebreak", tiedTeamIds: tied.map((t) => t.teamId).join(",") });
            } else {
              await bump({ phase: "winners" });
            }
            return { ok: true };
          }
          if (s.phase === "tiebreak") {
            // Reveal: the closest guess gets one extra point, which breaks the tie.
            const guesses = await tx.liveGuess.findMany({ where: { sessionId: s.id } });
            const closest = closestGuessers(guesses, Number(quiz.tiebreakAnswer));
            for (const teamId of closest) {
              await tx.liveScoreEvent.create({ data: { sessionId: s.id, teamId, roundIdx: quiz.rounds.length, points: 1, kind: "tiebreak" } });
            }
            await bump({ phase: "tiebreakReveal" });
            return { ok: true };
          }
          if (s.phase === "tiebreakReveal") {
            await bump({ phase: "winners" });
            return { ok: true };
          }
          return fail("There's nothing to continue from here.");
        }

        case "correct":
        case "wrong":
        case "skip": {
          if (s.phase !== "question" || !question || !round) return fail("No question is open.");
          const buzzes = await tx.liveBuzz.findMany({ where: { sessionId: s.id, questionId: question.id }, orderBy: { id: "asc" } });
          const answering = buzzes.find((b) => b.outcome === "pending");
          if (!answering || answering.id !== action.buzzId) return fail("That team isn't answering any more.");
          const place = buzzes.indexOf(answering);
          const rule = { rightPoints: round.rightPoints, wrongPenalty: round.wrongPenalty, placeDecay: round.placeDecay };
          const outcome = action.type === "correct" ? "correct" : action.type === "wrong" ? "wrong" : "skipped";
          const points = outcome === "correct" ? pointsForRight(rule, place) : pointsForWrong(rule);

          // Claim the buzz first, so a double tap can't score twice.
          const claimed = await tx.liveBuzz.updateMany({ where: { id: answering.id, outcome: "pending" }, data: { outcome } });
          if (claimed.count === 0) return fail("That team isn't answering any more.");
          await tx.liveScoreEvent.create({
            data: { sessionId: s.id, teamId: answering.teamId, questionId: question.id, roundIdx: s.roundIdx, buzzId: answering.id, points, kind: outcome },
          });
          if (outcome === "correct") {
            await bump({ phase: "celebrate", phaseUntil: new Date(Date.now() + CELEBRATE_MS), lastTeamId: answering.teamId, lastPoints: points });
          } else {
            // Wrong or skipped: the next team in the queue is up, with a fresh clock.
            const next = buzzes.find((b) => b.id !== answering.id && b.outcome === "pending");
            await bump({ phaseUntil: next ? answerDeadline() : null });
          }
          return { ok: true };
        }

        case "reveal": {
          if (s.phase !== "question") return fail("No question is open.");
          await bump({ phase: "reveal", phaseUntil: new Date(Date.now() + REVEAL_MS) });
          return { ok: true };
        }

        case "undo": {
          // One step back, whatever the last step was. Scores that were given are taken back; scores are never lost silently.
          if (s.status === "finished" && s.phase !== "ending") return fail("The night is finished. Reopen it first.");
          const lastRound = quiz.rounds.length - 1;
          const lastPosOf = (ri: number) => Math.max(0, (quiz.rounds[ri]?.questions.length ?? 1) - 1);
          const clockFor = async (questionId: string) =>
            (await tx.liveBuzz.count({ where: { sessionId: s.id, questionId, outcome: "pending" } })) > 0 ? answerDeadline() : null;
          const takeBack = async (ev: { id: number; buzzId: number | null }) => {
            await tx.liveScoreEvent.update({ where: { id: ev.id }, data: { undoneAt: new Date() } });
            if (ev.buzzId) await tx.liveBuzz.update({ where: { id: ev.buzzId }, data: { outcome: "pending" } });
          };
          // Open a question again. If it ended with a right answer, that answer is taken back so the team is up again.
          const reopen = async (ri: number, pos: number, clearBuzzesOf?: string): Promise<Done | Fail> => {
            const q = quiz.rounds[ri]?.questions[pos];
            if (!q) return fail("Nothing to undo.");
            const right = await tx.liveScoreEvent.findFirst({ where: { sessionId: s.id, questionId: q.id, kind: "correct", undoneAt: null }, orderBy: { id: "desc" } });
            if (right) await takeBack(right);
            if (clearBuzzesOf) await tx.liveBuzz.deleteMany({ where: { sessionId: s.id, questionId: clearBuzzesOf } });
            await bump({ phase: "question", roundIdx: ri, pos, questionOpenedAt: new Date(), phaseUntil: await clockFor(q.id), lastTeamId: null, lastPoints: null });
            return { ok: true };
          };

          switch (s.phase) {
            case "lobby":
              return fail("Nothing to undo yet.");
            case "roundIntro":
              if (s.roundIdx === 0) await bump({ phase: "lobby", phaseUntil: null });
              else await bump({ phase: "roundResults", roundIdx: s.roundIdx - 1, pos: lastPosOf(s.roundIdx - 1), phaseUntil: null });
              return { ok: true };
            case "question": {
              if (!question) return fail("Nothing to undo.");
              const last = await tx.liveScoreEvent.findFirst({
                where: { sessionId: s.id, questionId: question.id, undoneAt: null, kind: { in: ["correct", "wrong", "skipped"] } },
                orderBy: { id: "desc" },
              });
              if (last) {
                await takeBack(last);
                await bump({ phaseUntil: answerDeadline(), lastTeamId: null, lastPoints: null });
                return { ok: true };
              }
              // Nothing was scored on this question yet: go back to how the previous step left things.
              if (s.pos > 0) return reopen(s.roundIdx, s.pos - 1, question.id);
              await tx.liveBuzz.deleteMany({ where: { sessionId: s.id, questionId: question.id } });
              await bump({ phase: "roundIntro", phaseUntil: null });
              return { ok: true };
            }
            case "celebrate":
              return reopen(s.roundIdx, s.pos);
            case "reveal":
              if (!question) return fail("Nothing to undo.");
              await bump({ phase: "question", phaseUntil: await clockFor(question.id) });
              return { ok: true };
            case "roundResults":
              return reopen(s.roundIdx, lastPosOf(s.roundIdx));
            case "tiebreak":
              await bump({ phase: "roundResults", roundIdx: lastRound, pos: lastPosOf(lastRound), tiedTeamIds: null, phaseUntil: null });
              return { ok: true };
            case "tiebreakReveal":
              await tx.liveScoreEvent.updateMany({ where: { sessionId: s.id, kind: "tiebreak", undoneAt: null }, data: { undoneAt: new Date() } });
              await bump({ phase: "tiebreak" });
              return { ok: true };
            case "ending":
              await bump({ phase: "winners" });
              return { ok: true };
            case "winners":
              if (s.tiedTeamIds) await bump({ phase: "tiebreakReveal" });
              else await bump({ phase: "roundResults", roundIdx: lastRound, pos: lastPosOf(lastRound), phaseUntil: null });
              return { ok: true };
            default:
              return fail("You can't undo from here.");
          }
        }

        case "release": {
          const team = await tx.liveTeam.findFirst({ where: { id: action.teamId, sessionId: s.id } });
          if (!team) return fail("Team not found", 404);
          await tx.liveTeam.update({ where: { id: team.id }, data: { tokenHash: `released:${randomBytes(12).toString("hex")}` } });
          await bump();
          return { ok: true };
        }

        case "setHide": {
          const n = Math.floor(action.hideFromRound);
          if (!(n >= 1 && n <= quiz.rounds.length + 1)) return fail("Pick a round number.", 400);
          await bump({ hideFromRound: n });
          return { ok: true };
        }

        case "setCarry": {
          // Points a team already earned in rounds played off the system. They count toward the total,
          // but sit outside every round (roundIdx -1) so they never show up in a round's own points.
          const team = await tx.liveTeam.findFirst({ where: { id: action.teamId, sessionId: s.id } });
          if (!team) return fail("Team not found", 404);
          await tx.liveScoreEvent.updateMany({ where: { sessionId: s.id, teamId: team.id, kind: "carry", undoneAt: null }, data: { undoneAt: new Date() } });
          if (action.points !== 0) {
            await tx.liveScoreEvent.create({ data: { sessionId: s.id, teamId: team.id, roundIdx: -1, points: action.points, kind: "carry" } });
          }
          await bump();
          return { ok: true };
        }

        case "finish": {
          // Only the status changes, so the night can be reopened exactly where it was. The screens show the winners while it is finished.
          await bump({ status: "finished" });
          return { ok: true };
        }

        case "showEnding": {
          // The thank-you slide comes after the winners. It only follows the real winners screen, so Undo has one place to return to.
          if (s.phase !== "winners") return fail("The thank-you slide comes after the winners screen.");
          await bump({ phase: "ending" });
          return { ok: true };
        }

        case "reopen": {
          if (s.status !== "finished") return fail("This night isn't finished.");
          const waiting = s.phase === "question" && question ? await tx.liveBuzz.count({ where: { sessionId: s.id, questionId: question.id, outcome: "pending" } }) : 0;
          await bump({ status: "active", ...(s.phase === "question" ? { phaseUntil: waiting > 0 ? answerDeadline() : null } : {}) });
          return { ok: true };
        }
      }
    },
    { timeout: 15000 }
  );
}

// ---------------------------------------------------------------------------
// What the screens get
// ---------------------------------------------------------------------------

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;

async function loadSnapshot(sessionId: string) {
  const stored = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!stored) return null;
  // A finished night shows the winners on every screen. The stored phase is kept so the night can be reopened where it was.
  const s = { ...stored, phase: stored.status === "finished" && stored.phase !== "ending" ? "winners" : stored.phase };
  const quiz = await loadQuiz(prisma, s.quizId);
  const round = quiz.rounds[s.roundIdx] ?? null;
  const question = round?.questions[s.pos] ?? null;
  const showsQuestion = ["question", "reveal", "celebrate"].includes(s.phase);
  const [teams, buzzes, totals] = await Promise.all([
    prisma.liveTeam.findMany({ where: { sessionId }, select: { id: true, name: true }, orderBy: { joinedAt: "asc" } }),
    question && showsQuestion ? prisma.liveBuzz.findMany({ where: { sessionId, questionId: question.id }, orderBy: { id: "asc" } }) : Promise.resolve([]),
    totalsByTeam(prisma, sessionId),
  ]);
  return { s, quiz, teams, round, question, buzzes, totals };
}

function queueOf(snap: NonNullable<Snapshot>, limit: number | null): LiveQueueItem[] {
  const { s, teams, buzzes } = snap;
  const names = new Map(teams.map((t) => [t.id, t.name]));
  const opened = s.questionOpenedAt?.getTime() ?? buzzes[0]?.buzzedAt.getTime() ?? 0;
  const first = buzzes[0]?.buzzedAt.getTime() ?? 0;
  const pendingIdx = buzzes.findIndex((b) => b.outcome === "pending");
  const items: LiveQueueItem[] = buzzes.map((b, i) => ({
    buzzId: b.id,
    teamId: b.teamId,
    teamName: names.get(b.teamId) ?? "Team",
    place: i,
    atMs: Math.max(0, b.buzzedAt.getTime() - opened),
    gapMs: Math.max(0, b.buzzedAt.getTime() - first),
    outcome: b.outcome as LiveQueueItem["outcome"],
    answering: s.phase === "question" && i === pendingIdx,
  }));
  if (limit === null || items.length <= limit) return items;
  const anchor = pendingIdx === -1 ? items.length : pendingIdx;
  const start = Math.max(0, Math.min(anchor - 1, items.length - limit));
  return items.slice(start, start + limit);
}

export async function getLiveState(sessionId: string, view: "host" | "screen"): Promise<LiveState | null> {
  const snap = await loadSnapshot(sessionId);
  if (!snap) return null;
  const { s, quiz, teams, round, question, totals } = snap;
  const host = view === "host";
  const standings = standingsOf(teams, totals);
  const roundNo = s.roundIdx + 1;
  const resultsVisible = roundNo < s.hideFromRound;

  const phase = s.phase as LiveState["phase"];
  const revealed = phase === "reveal" || phase === "celebrate";
  const answer = question && (host || revealed) ? { text: question.answer, note: question.note } : null;

  let roundResult: LiveState["roundResult"] = null;
  if (phase === "roundResults" && round && (host || resultsVisible)) {
    const inRound = await totalsByTeam(prisma, s.id, s.roundIdx);
    const ranked = rankTeams(teams.map((t) => ({ teamId: t.id, name: t.name, score: totals.get(t.id) ?? 0 })));
    roundResult = {
      name: round.name,
      rows: ranked.map((r) => ({ teamId: r.teamId, name: r.name, roundPoints: inRound.get(r.teamId) ?? 0, total: r.score, rank: r.rank })),
    };
  }

  const leaderboard: LiveState["leaderboard"] = host
    ? standings.map((r) => ({ teamId: r.teamId, name: r.name, score: r.score, rank: r.rank }))
    : phase === "winners" || (phase === "roundResults" && resultsVisible)
      ? standings.map((r) => ({ teamId: r.teamId, name: r.name, score: r.score, rank: r.rank }))
      : null;

  const queue = queueOf(snap, host ? null : 4);
  const canSkipQuestion = phase === "question"; // the quizmaster can always show the answer and move on

  const lastTeam = s.lastTeamId ? teams.find((t) => t.id === s.lastTeamId) : null;
  const celebration = phase === "celebrate" && lastTeam && question
    ? { teamName: lastTeam.name, points: s.lastPoints ?? 0, answer: question.answer, note: question.note }
    : null;

  let tiebreak: LiveState["tiebreak"] = null;
  if ((phase === "tiebreak" || phase === "tiebreakReveal") && quiz.tiebreakPrompt) {
    const tiedIds = (s.tiedTeamIds ?? "").split(",").filter(Boolean);
    const guesses = await prisma.liveGuess.findMany({ where: { sessionId: s.id } });
    const names = new Map(teams.map((t) => [t.id, t.name]));
    const reveal = phase === "tiebreakReveal";
    const winners = reveal ? closestGuessers(guesses, Number(quiz.tiebreakAnswer)).map((id) => names.get(id) ?? "Team") : [];
    tiebreak = {
      prompt: quiz.tiebreakPrompt,
      tied: tiedIds.map((id) => ({ id, name: names.get(id) ?? "Team" })),
      guesses: host || reveal ? guesses.map((g) => ({ teamId: g.teamId, name: names.get(g.teamId) ?? "Team", value: g.value })) : [],
      guessedCount: guesses.length,
      answer: reveal ? (quiz.tiebreakAnswer ?? null) : null,
      winners,
    };
  }

  return {
    version: s.version,
    now: Date.now(),
    sessionId: s.id,
    code: s.code,
    status: s.status as LiveState["status"],
    phase,
    quizTitle: quiz.title,
    roundNo,
    roundCount: quiz.rounds.length,
    roundName: round?.name ?? "",
    roundBlurb: round?.blurb ?? "",
    rightPoints: round?.rightPoints ?? 0,
    wrongPenalty: round?.wrongPenalty ?? 0,
    placeDecay: round?.placeDecay ?? false,
    questionNo: s.pos + 1,
    questionCount: round?.questions.length ?? 0,
    question: question && ["question", "reveal", "celebrate"].includes(phase)
      ? { id: question.id, kind: question.kind, prompt: question.prompt, hint: question.hint, audioUrl: question.audioUrl }
      : null,
    answer: ["question", "reveal", "celebrate"].includes(phase) ? answer : null,
    openedAt: s.questionOpenedAt?.getTime() ?? null,
    phaseUntil: s.phaseUntil?.getTime() ?? null,
    queue,
    celebration,
    teams,
    leaderboard,
    roundResult,
    scoresHidden: !host && phase === "roundResults" && !resultsVisible,
    hideFromRound: s.hideFromRound,
    canSkipQuestion,
    tiebreak,
  };
}

export async function getTeamState(code: string, teamId: string, token: string): Promise<LiveTeamState | Fail> {
  const stored = await prisma.liveSession.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!stored) return fail("We can't find that night.", 404);
  const s = { ...stored, phase: stored.status === "finished" && stored.phase !== "ending" ? "winners" : stored.phase };
  const sessionId = s.id;
  const quiz = await loadQuiz(prisma, s.quizId);
  const round = quiz.rounds[s.roundIdx] ?? null;
  const question = round?.questions[s.pos] ?? null;
  const showsQuestion = ["question", "reveal", "celebrate"].includes(s.phase);
  const [team, buzzes] = await Promise.all([
    prisma.liveTeam.findFirst({ where: { id: teamId, sessionId, tokenHash: hash(token) } }),
    question && showsQuestion ? prisma.liveBuzz.findMany({ where: { sessionId, questionId: question.id }, orderBy: { id: "asc" } }) : Promise.resolve([]),
  ]);
  if (!team) return fail("This phone isn't part of the quiz.", 403);

  const idx = buzzes.findIndex((b) => b.teamId === team.id);
  const pendingIdx = buzzes.findIndex((b) => b.outcome === "pending");
  const myBuzz = idx >= 0 ? { place: idx, outcome: buzzes[idx].outcome as "pending" | "correct" | "wrong" | "skipped", answering: s.phase === "question" && idx === pendingIdx } : null;

  let tiebreak: LiveTeamState["tiebreak"] = null;
  if (s.phase === "tiebreak" && quiz.tiebreakPrompt) {
    const tied = (s.tiedTeamIds ?? "").split(",");
    const guess = await prisma.liveGuess.findUnique({ where: { sessionId_teamId: { sessionId, teamId: team.id } } });
    tiebreak = { mustGuess: tied.includes(team.id), myGuess: guess?.value ?? null, prompt: quiz.tiebreakPrompt };
  }

  return {
    version: s.version,
    now: Date.now(),
    code: s.code,
    status: s.status as LiveTeamState["status"],
    // Phones keep the final scores up while the projector shows the thank-you slide.
    phase: (s.phase === "ending" ? "winners" : s.phase) as LiveTeamState["phase"],
    roundNo: s.roundIdx + 1,
    roundName: round?.name ?? "",
    questionNo: s.pos + 1,
    questionCount: round?.questions.length ?? 0,
    team: { id: team.id, name: team.name },
    buzzOpen: s.phase === "question" && !myBuzz,
    myBuzz,
    turnUntil: myBuzz?.answering ? (s.phaseUntil?.getTime() ?? null) : null,
    tiebreak,
  };
}

// ---------------------------------------------------------------------------
// Quizzes (the question bank)
// ---------------------------------------------------------------------------

export type QuizImport = {
  title: string;
  tiebreak?: { prompt: string; answer: string } | null;
  rounds: {
    name: string;
    blurb?: string;
    rightPoints: number;
    wrongPenalty: number;
    placeDecay: boolean;
    questions: { kind: string; prompt: string; hint?: string | null; answer: string; note?: string | null; audioUrl?: string | null }[];
  }[];
};

export async function importQuiz(data: QuizImport): Promise<string> {
  const quiz = await prisma.liveQuiz.create({
    data: {
      title: data.title,
      tiebreakPrompt: data.tiebreak?.prompt ?? null,
      tiebreakAnswer: data.tiebreak?.answer ?? null,
      rounds: {
        create: data.rounds.map((r, ri) => ({
          order: ri + 1,
          name: r.name,
          blurb: r.blurb ?? "",
          rightPoints: r.rightPoints,
          wrongPenalty: r.wrongPenalty,
          placeDecay: r.placeDecay,
          questions: {
            create: r.questions.map((q, qi) => ({
              order: qi + 1,
              kind: q.kind,
              prompt: q.prompt,
              hint: q.hint ?? null,
              answer: q.answer,
              note: q.note ?? null,
              audioUrl: q.audioUrl ?? null,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
  return quiz.id;
}
