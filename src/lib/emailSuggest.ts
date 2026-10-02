const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "ymail.com",
  "yahoo.co.in",
  "rediffmail.com",
  "protonmail.com",
  "proton.me",
];

// Real domains that sit within edit distance of a common one — never "correct" these.
const OTHER_REAL_DOMAINS = new Set(["mail.com", "email.com"]);

// Edit distance where swapping two adjacent letters ("gmial") counts as one edit.
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Returns a corrected address when the domain looks like a typo of a common
// provider (gmqil.com -> gmail.com), otherwise null. Only ever a suggestion —
// custom domains and anything already correct are left alone.
export function suggestEmail(raw: string): string | null {
  const email = raw.trim();
  const at = email.lastIndexOf("@");
  if (at < 1 || at !== email.indexOf("@")) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain) return null;

  if (COMMON_DOMAINS.includes(domain) || OTHER_REAL_DOMAINS.has(domain)) return null;

  // "name@gmail" — the .com was forgotten.
  if (!domain.includes(".")) {
    const match = COMMON_DOMAINS.find((d) => d.split(".")[0] === domain);
    return match ? `${local}@${match}` : null;
  }

  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of COMMON_DOMAINS) {
    const dist = distance(domain, candidate);
    if (dist < bestDistance) {
      best = candidate;
      bestDistance = dist;
    }
  }
  return best ? `${local}@${best}` : null;
}
