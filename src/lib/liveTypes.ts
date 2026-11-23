// What the projector, the quizmaster's phone and the team phones receive. Safe to import in the browser.

export type LivePhase = "lobby" | "roundIntro" | "question" | "reveal" | "celebrate" | "roundResults" | "tiebreak" | "tiebreakReveal" | "winners" | "ending";

export type LiveQueueItem = {
  buzzId: number;
  teamId: string;
  teamName: string;
  place: number; // 0 = first to buzz
  atMs: number; // milliseconds after the buzzer opened
  gapMs: number; // milliseconds behind the first buzz
  outcome: "pending" | "correct" | "wrong" | "skipped";
  answering: boolean;
};

export type LiveStanding = { teamId: string; name: string; score: number; rank: number };

export type LiveRoundResult = { name: string; rows: { teamId: string; name: string; roundPoints: number; total: number; rank: number }[] };

export type LiveState = {
  version: number;
  now: number; // server clock, ms
  sessionId: string;
  code: string;
  status: "active" | "finished";
  slide: "winners" | "ending" | null; // the host has the winners or thank-you slide up: the quiz is paused where it was
  phase: LivePhase;
  quizTitle: string;
  roundNo: number; // 1-based
  roundCount: number;
  roundName: string;
  roundBlurb: string;
  rightPoints: number;
  wrongPenalty: number;
  placeDecay: boolean;
  questionNo: number; // 1-based, within the round
  questionCount: number;
  question: { id: string; kind: string; prompt: string; hint: string | null; audioUrl: string | null } | null;
  answer: { text: string; note: string | null } | null; // the host always gets it; the projector only once it is revealed
  openedAt: number | null; // when the buzzer opens, on the server's clock. It is a moment slightly in the future after the host moves on, so every screen and phone opens at the same instant.
  lockUntil: number | null; // once a team has buzzed: when the order is final. Until then nobody is "answering" yet, so a slow connection can still get its place.
  step: string; // which step of the night this is (see stepOf). The quizmaster's taps carry it, so a repeated or late tap can't skip a question.
  phaseUntil: number | null; // when a timed phase moves on; during a question, when the team that is answering runs out of time
  queue: LiveQueueItem[];
  celebration: { teamName: string; points: number; answer: string; note: string | null } | null;
  teams: { id: string; name: string }[];
  leaderboard: LiveStanding[] | null; // null when the scores are hidden from the room
  roundResult: LiveRoundResult | null;
  scoresHidden: boolean; // the room is not being shown scores right now, on purpose
  hideFromRound: number;
  canSkipQuestion: boolean;
  tiebreak: {
    prompt: string;
    tied: { id: string; name: string }[];
    guesses: { teamId: string; name: string; value: number }[]; // host: always. projector: only after the reveal
    guessedCount: number;
    answer: string | null; // after the reveal
    winners: string[]; // team names, after the reveal
  } | null;
};

export type LiveTeamState = {
  version: number;
  now: number;
  code: string;
  status: "active" | "finished";
  phase: LivePhase;
  roundNo: number;
  roundName: string;
  questionNo: number;
  questionCount: number;
  team: { id: string; name: string };
  questionId: string | null; // the question the buzzer belongs to, so a late retry can never land on the next one
  openedAt: number | null; // when the buzzer opens (server clock)
  lockUntil: number | null; // when the order of buzzes is final (server clock)
  buzzOpen: boolean; // the buzzer can be pressed once the opening time has come
  myBuzz: { place: number; outcome: "pending" | "correct" | "wrong" | "skipped"; answering: boolean } | null;
  turnUntil: number | null; // when this team runs out of time to answer, if it is answering now
  tiebreak: { mustGuess: boolean; myGuess: number | null; prompt: string } | null;
};

export type HostAction =
  | { type: "start" }
  | { type: "continue" }
  | { type: "correct"; buzzId: number }
  | { type: "wrong"; buzzId: number }
  | { type: "skip"; buzzId: number }
  | { type: "reveal" } // show the answer and move on (this is also the "skip question" button)
  | { type: "undo" }
  | { type: "release"; teamId: string }
  | { type: "setHide"; hideFromRound: number }
  | { type: "setCarry"; teamId: string; points: number } // a team's score from rounds played off the system; counts toward the total only
  | { type: "finish" }
  | { type: "reopen" }
  | { type: "showWinners" }
  | { type: "showEnding" }; // carry on with a night that was ended

// A tap from the quizmaster says which step of the night it was made on. If the night has moved on since
// (a slow connection, a double tap, a retry), the tap is ignored instead of acting on the wrong question.
// `version` is also checked for Undo, which can happen more than once within the same step.
export type HostExpect = { step: string; version: number };

export function stepOf(s: { status: string; phase: string; roundIdx: number; pos: number }): string {
  return `${s.status}|${s.phase}|${s.roundIdx}|${s.pos}`;
}

export const ANSWER_MS = 15_000; // how long a team has to answer once it is up
export const OPEN_LEAD_MS = 2_000; // a question opens this long after the quizmaster moves on (the "get ready" beat), the same instant everywhere
export const LOCK_MS = 1_200; // after the first buzz is heard, the order stays open this long for slower connections, then it is final
export const EARLY_BUZZ_MS = 200; // a buzz may arrive this much before the opening time (the phone's clock is a little off) and still count
export const MAX_BUZZ_AGE_MS = 8_000; // a buzz that was pressed longer ago than this is treated as pressed when it arrived
