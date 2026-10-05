import { mapsLinkFor, safeHttpUrl } from "./eventLinks";

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

type MessageEvent = {
  title: string;
  date: string;
  venueName: string;
  venueArea: string;
  mapsUrl: string | null;
  districtUrl: string | null;
  swiggyUrl: string | null;
  reminderOfferNote: string | null;
};
type MessageBooking = { contactName: string; teamName: string; teamSize: number };

// The ready-typed WhatsApp message. Mirrors the reminder email: the night,
// where, the guest's private RSVP link and the table-booking offer. Plain text
// (plus WhatsApp's *bold*) so it reads naturally in a chat.
export function whatsappMessage(booking: MessageBooking, event: MessageEvent, rsvpUrl: string): string {
  const when = new Date(event.date);
  const date = when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: IST });
  const time = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: IST });

  const parts = [
    `Hi ${booking.contactName}, it's James from It's Olam Company.`,
    `Almost showtime! Your team *${booking.teamName}* (${booking.teamSize} players) is down for *${event.title}*.`,
    [`When: ${date} at ${time}`, `Where: ${event.venueName}, ${event.venueArea}`, `Location: ${mapsLinkFor(event)}`].join("\n"),
    [`Are you still coming? Tell us your final headcount here (takes ten seconds): ${rsvpUrl}`, "Can't make it? Use the same link and let us know."].join("\n"),
  ];

  const district = safeHttpUrl(event.districtUrl);
  const swiggy = safeHttpUrl(event.swiggyUrl);
  const note = event.reminderOfferNote?.trim();
  if (note || district || swiggy) {
    const offer = ["*Lock your table (optional)*", note || "You can get 20% off your bill if you book your table through Swiggy or District:"];
    if (district) offer.push(`Book on District: ${district}`);
    if (swiggy) offer.push(`Book on Swiggy Dineout: ${swiggy}`);
    parts.push(offer.join("\n"));
  }
  return parts.join("\n\n");
}

export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
