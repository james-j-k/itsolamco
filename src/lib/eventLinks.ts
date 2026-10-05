// Only ever hand a plain web link to an href. Admin-entered links are
// validated on save, but this is the last line of defence at render time
// (it rejects javascript:, data: and anything that isn't http(s)).
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return URL.canParse(trimmed) ? trimmed : null;
}

export function hasPassed(date: Date): boolean {
  return date.getTime() < Date.now();
}

type MapsInput ={ mapsUrl?: string | null; venueName: string; venueArea: string };

// The admin's pasted Google Maps share link when there is one; otherwise a
// Maps search for the venue, which can land on the wrong place if the name is
// ambiguous — which is why the explicit link is preferred.
export function mapsLinkFor(event: MapsInput): string {
  const explicit = safeHttpUrl(event.mapsUrl);
  if (explicit) return explicit;
  const query = encodeURIComponent(`${event.venueName} ${event.venueArea} Kochi`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
