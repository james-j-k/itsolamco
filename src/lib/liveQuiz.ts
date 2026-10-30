import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { closestGuessers, pointsForRight, pointsForWrong, rankTeams, tiedForFirst } from "@/lib/liveScoring";
import { SKIP_AFTER_MS, type HostAction, type LiveQueueItem, type LiveState, type LiveTeamState } from "@/lib/liveTypes";

// The brain of a live quiz night. Every change happens inside one database
// transaction and bumps `version`, so the projector and the phones only ask for
// the full picture when something has actually changed.

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
  const select = { id: true, version: true, phase: true, phaseUntil: true } as const;
  const key = "code" in where ? { code: where.code.trim().toUpperCase() } : where;
  let s = await prisma.liveSession.findUnique({ where: key, select });
  if (s && s.phaseUntil && s.phaseUntil.getTime() <= Date.now() && (s.phase === "celebrate" || s.phase === "reveal")) {
    await tick(s.id);
    s = await prisma.liveSession.findUnique({ where: key, select });
  }
  return s ? { id: s.id, version: s.version } : null;
}

// Timed phases (the celebration, the revealed answer) move on by themselves.
// Whoever asks first after the time is up moves it; the conditional update means it happens once.
export async function tick(sessionId: string): Promise<void> {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!s || !s.phaseUntil || s.phaseUntil.getTime() > Date.now()) return;
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
    if (session.phase !== "question") return fail("The buzzer isn't open right now.");
    const quiz = await loadQuiz(tx, session.quizId);
    const q = quiz.rounds[session.roundIdx]?.questions[session.pos];
    if (!q) return fail("No question is open.");

    // One team, one buzz per question. A second tap (or a second phone) changes nothing.
    const existing = await tx.liveBuzz.findUnique({ where: { sessionId_questionId_teamId: { sessionId: session.id, questionId: q.id, teamId: team.id } } });
    if (!existing) {
      await tx.liveBuzz.create({ data: { sessionId: session.id, questionId: q.id, teamId: team.id } });
      await tx.liveSession.update({ where: { id: session.id }, data: { version: { increment: 1 } } });
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
    if (session.phase !== "tiebreak") return fail("The tie-breaker isn't open.");
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
      if (s.status === "finished" && action.type !== "setHide") return fail("This night is finished.");
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
            await bump();
          }
          return { ok: true };
        }

        case "reveal": {
          if (s.phase !== "question") return fail("No question is open.");
          await bump({ phase: "reveal", phaseUntil: new Date(Date.now() + REVEAL_MS) });
          return { ok: true };
        }

        case "undo": {
          if (!["question", "celebrate", "reveal", "roundResults"].includes(s.phase)) return fail("You can't undo from here.");
          const last = await tx.liveScoreEvent.findFirst({
            where: { sessionId: s.id, undoneAt: null, kind: { in: ["correct", "wrong", "skipped"] } },
            orderBy: { id: "desc" },
          });
          if (!last || !last.questionId) return fail("Nothing to undo.");
          let roundIdx = -1;
          let pos = -1;
          quiz.rounds.forEach((r, ri) => r.questions.forEach((q, qi) => {
            if (q.id === last.questionId) {
              roundIdx = ri;
              pos = qi;
            }
          }));
          if (roundIdx < 0) return fail("That question no longer exists.");
          await tx.liveScoreEvent.update({ where: { id: last.id }, data: { undoneAt: new Date() } });
          if (last.buzzId) await tx.liveBuzz.update({ where: { id: last.buzzId }, data: { outcome: "pending" } });
          // If the night has already moved on, bring that question back. Teams that had
          // only just buzzed on the newer question are cleared (nothing was scored there).
          if (question && question.id !== last.questionId) {
            await tx.liveBuzz.deleteMany({ where: { sessionId: s.id, questionId: question.id } });
          }
          await bump({ phase: "question", roundIdx, pos, questionOpenedAt: new Date(), phaseUntil: null, lastTeamId: null, lastPoints: null });
          return { ok: true };
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

        case "finish": {
          await bump({ status: "finished", phase: "winners" });
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
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!s) return null;
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
  const { s, quiz, teams, round, question, buzzes, totals } = snap;
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
  const noPending = !buzzes.some((b) => b.outcome === "pending");
  const sinceOpen = s.questionOpenedAt ? Date.now() - s.questionOpenedAt.getTime() : 0;
  const canSkipQuestion = phase === "question" && noPending && (sinceOpen >= SKIP_AFTER_MS || buzzes.some((b) => b.outcome !== "pending"));

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
    skipAfterMs: SKIP_AFTER_MS,
    tiebreak,
  };
}

export async function getTeamState(code: string, teamId: string, token: string): Promise<LiveTeamState | Fail> {
  const s = await prisma.liveSession.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!s) return fail("We can't find that night.", 404);
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
    phase: s.phase as LiveTeamState["phase"],
    roundNo: s.roundIdx + 1,
    roundName: round?.name ?? "",
    questionNo: s.pos + 1,
    questionCount: round?.questions.length ?? 0,
    team: { id: team.id, name: team.name },
    buzzOpen: s.phase === "question" && !myBuzz,
    myBuzz,
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
