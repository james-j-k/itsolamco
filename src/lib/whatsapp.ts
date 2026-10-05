import { mapsLinkFor } from "./eventLinks";

const IST = "Asia/Kolkata";

// Turns whatever a guest typed into the digits-only international form that
// wa.me needs (no "+", no spaces), or null when it can't be trusted to be a
// real number. Guests type these freely: "+91 98765 43210", "9876543210",
// "09876543210", "(+91) 98765-43210"...
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);

  const indianMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

  if (international) {
    // A "+" followed by just a 10-digit Indian mobile means the country code was left out.
    if (indianMobile(digits)) return `91${digits}`;
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (digits.length === 10) return indianMobile(digits) ? `91${digits}` : null;
  if (digits.length === 11 && digits.startsWith("0")) return indianMobile(digits.slice(1)) ? `91${digits.slice(1)}` : null;
  if (digits.length === 12 && digits.startsWith("91")) return indianMobile(digits.slice(2)) ? digits : null;
  return null;
}

type MessageEvent = { title: string; date: string; venueName: string; venueArea: string; mapsUrl: string | null };

// The ready-typed WhatsApp message: the night, where, and the guest's private
// RSVP link. Plain text on purpose so it reads naturally in a chat.
export function whatsappMessage(contactName: string, event: MessageEvent, rsvpUrl: string): string {
  const when = new Date(event.date);
  const date = when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: IST });
  const time = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: IST });
  return [
    `Hi ${contactName}, it's Olam Company. Quick reminder: ${event.title} is on ${date} at ${time}, ${event.venueName}, ${event.venueArea}.`,
    `Location: ${mapsLinkFor(event)}`,
    `Are you still coming? Confirm your headcount here: ${rsvpUrl}`,
  ].join("\n\n");
}

export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
