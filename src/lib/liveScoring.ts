// The points rules for a live quiz night. Pure functions, no database, so they can be
// tested on their own. "Place" is 0-based: the first team to buzz is place 0.

export type RoundRule = {
  rightPoints: number; // points for a right answer
  wrongPenalty: number; // points lost for a wrong answer or a skip (0 = this round has no negatives)
  placeDecay: boolean; // later places score less. Only applies to rounds with no penalty.
};

// Rounds without negative marking: each place down loses 10% of the points
// (10, 9, 8, 7 ... for a 10-point round), never below 1. Rounds with negative
// marking pay the same to whichever team gets it right: the penalty already
// punishes the teams that had a go first.
export function pointsForRight(rule: RoundRule, place: number): number {
  if (rule.placeDecay && rule.wrongPenalty === 0 && place > 0) {
    return Math.max(1, Math.round(rule.rightPoints * (1 - 0.1 * place)));
  }
  return rule.rightPoints;
}

// A wrong answer and a skip cost the same. Rounds with no negatives cost nothing.
export function pointsForWrong(rule: RoundRule): number {
  return rule.wrongPenalty > 0 ? -rule.wrongPenalty : 0;
}

export type Standing = { teamId: string; name: string; score: number; rank: number };

// Highest score first. Teams on the same score share a rank (1, 1, 3 ...). Equal scores are listed by name.
export function rankTeams(teams: { teamId: string; name: string; score: number }[]): Standing[] {
  const sorted = [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((t, i) => {
    if (i === 0 || t.score !== sorted[i - 1].score) rank = i + 1;
    return { ...t, rank };
  });
}

// Teams level on the top score (empty when there are fewer than two teams, or when the top score is not shared).
export function tiedForFirst(standings: Standing[]): Standing[] {
  const top = standings.filter((s) => s.rank === 1);
  return top.length > 1 ? top : [];
}

// For the tie-breaker: the closest number to the answer wins. Returns the ids of the closest teams.
export function closestGuessers(guesses: { teamId: string; value: number }[], answer: number): string[] {
  if (guesses.length === 0) return [];
  const best = Math.min(...guesses.map((g) => Math.abs(g.value - answer)));
  return guesses.filter((g) => Math.abs(g.value - answer) === best).map((g) => g.teamId);
}
