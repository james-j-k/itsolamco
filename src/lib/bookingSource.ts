// Bookings imported from the venue's ticketing app (not signed up on our site).
export const TICKETING_SOURCE = "ticketing";

export function isTicketing(booking: { source?: string | null }): boolean {
  return booking.source === TICKETING_SOURCE;
}

export function ticketCount(n: number): string {
  return `${n} ${n === 1 ? "ticket" : "tickets"}`;
}
