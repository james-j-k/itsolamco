// What the projector, the quizmaster's phone and the team phones receive. Safe to import in the browser.

export type LivePhase = "lobby" | "roundIntro" | "question" | "reveal" | "celebrate" | "roundResults" | "tiebreak" | "tiebreakReveal" | "winners";

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
  openedAt: number | null;
  phaseUntil: number | null;
  queue: LiveQueueItem[];
  celebration: { teamName: string; points: number; answer: string; note: string | null } | null;
  teams: { id: string; name: string }[];
  leaderboard: LiveStanding[] | null; // null when the scores are hidden from the room
  roundResult: LiveRoundResult | null;
  scoresHidden: boolean; // the room is not being shown scores right now, on purpose
  hideFromRound: number;
  canSkipQuestion: boolean;
  skipAfterMs: number;
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
  buzzOpen: boolean; // the buzzer can be pressed right now
  myBuzz: { place: number; outcome: "pending" | "correct" | "wrong" | "skipped"; answering: boolean } | null;
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
  | { type: "finish" };

export const SKIP_AFTER_MS = 30_000;
