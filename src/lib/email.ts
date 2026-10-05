import { Resend } from "resend";
import { mapsLinkFor, safeHttpUrl } from "./eventLinks";

const FROM = process.env.EMAIL_FROM ?? "It's Olam Company <notify@itsolamco.in>";
const ADMIN_TO = process.env.EMAIL_TO ?? "itsolamco@gmail.com";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resend's SDK doesn't throw when the API rejects an email (bad address,
// daily quota hit, rate limit...) — it hands back { error }. Ignoring that
// would mark rejected emails as "Sent ✓", so every send goes through here.
// A per-second rate limit gets one retry; anything else fails loudly.
async function sendOrThrow(client: Resend, payload: Parameters<Resend["emails"]["send"]>[0]) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.emails.send(payload);
    if (!error) return;
    if (attempt === 0 && error.name === "rate_limit_exceeded") {
      await sleep(1100);
      continue;
    }
    throw new Error(`Resend rejected the email (${error.name}${error.statusCode ? ` ${error.statusCode}` : ""}): ${error.message}`);
  }
}

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY is not set — skipping email send. Sign up at resend.com, then set RESEND_API_KEY in .env."
    );
    return null;
  }
  return new Resend(apiKey);
}

// Everything customers type ends up inside HTML emails (including the ones
// sent to the site owner), so it has to be escaped or someone could slip
// links and markup into them. Subject lines are plain text, so they're not.
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmail(bodyHtml: string) {
  return `
    <div style="background:#F5F0E6;padding:32px;font-family:Georgia,serif;color:#1C1712;">
      <div style="max-width:480px;margin:0 auto;background:#F5F0E6;border:2px solid #1C1712;padding:32px;">
        <div style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#B8451D;text-transform:uppercase;margin-bottom:24px;">
          It's Olam Company
        </div>
        ${bodyHtml}
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(28,23,18,.2);font-family:monospace;font-size:10px;letter-spacing:1px;color:#8C8477;text-transform:uppercase;">
          Kochi's Mollywood Trivia Outfit
        </div>
      </div>
    </div>
  `;
}

type BookingWithEvent = {
  id: string;
  teamName: string;
  contactName: string;
  email: string;
  teamSize: number;
  status: string;
  event: EmailEvent | null;
};

type EmailEvent = { title: string; date: Date; venueName: string; venueArea: string };

// Events are in Kochi but the server runs in UTC, so format in IST explicitly —
// otherwise a 7:30 PM start would read as 2:00 PM and late-night events could
// land on the wrong date.
const EVENT_TZ = "Asia/Kolkata";

function eventDateText(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: EVENT_TZ,
  });
}

function eventTimeText(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: EVENT_TZ });
}

function eventTitleFor(event: EmailEvent | null) {
  return event ? esc(event.title) : "the next available night";
}

// One-line form for sentences that don't get the full details block.
function eventLineFor(event: EmailEvent | null) {
  return event ? `${esc(event.title)} on ${eventDateText(event.date)}` : "the next available night";
}

// When and where, set apart so it's the first thing a customer looks for.
// Empty when there's no event to describe (nothing scheduled yet).
function eventDetailsBlock(event: EmailEvent | null, mapsHref?: string) {
  if (!event) return "";
  return `
    <div style="margin:20px 0;padding:16px;border:1px solid rgba(28,23,18,.25);">
      <div style="font-size:17px;font-weight:bold;">${eventDateText(event.date)} · ${eventTimeText(event.date)}</div>
      <div style="font-size:14px;color:#8C8477;margin-top:4px;">${esc(event.venueName)}, ${esc(event.venueArea)}</div>
      ${mapsHref ? `<div style="margin-top:10px;"><a href="${esc(mapsHref)}" style="color:#B8451D;font-size:14px;">Open in Google Maps →</a></div>` : ""}
    </div>
  `;
}

// Returns whether the emails were actually sent (false when RESEND_API_KEY
// isn't configured) so callers can distinguish "skipped" from "sent".
export async function sendBookingEmails(booking: BookingWithEvent): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const eventLine = eventLineFor(booking.event);

  const [toCustomer, toAdmin] = await Promise.allSettled([
    sendOrThrow(client, {
      from: FROM,
      to: booking.email,
      subject: "Slot requested — It's Olam Company",
      html: wrapEmail(`
        <h1 style="font-size:24px;margin:0 0 16px;">See you there, ${esc(booking.contactName)}.</h1>
        <p style="line-height:1.6;">We've got your team <strong>${esc(booking.teamName)}</strong> (${booking.teamSize} players) down for <strong>${eventTitleFor(booking.event)}</strong>.</p>
        ${eventDetailsBlock(booking.event)}
        <p style="line-height:1.6;">We'll confirm your slot shortly.</p>
      `),
    }),
    sendOrThrow(client, {
      from: FROM,
      to: ADMIN_TO,
      subject: `New booking: ${booking.teamName}`,
      html: wrapEmail(`
        <h1 style="font-size:20px;margin:0 0 16px;">New team registered</h1>
        <p style="line-height:1.6;">
          <strong>${esc(booking.teamName)}</strong> (${booking.teamSize} players)<br/>
          Contact: ${esc(booking.contactName)} — ${esc(booking.email)}<br/>
          Event: ${eventLine}
        </p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin" style="color:#B8451D;">Review in admin →</a></p>
      `),
    }),
  ]);
  if (toAdmin.status === "rejected") console.error("Admin notification email failed:", toAdmin.reason);
  if (toCustomer.status === "rejected") throw toCustomer.reason;
  return true;
}

// Manually triggered from the admin panel when the admin changes a booking's
// status and/or team size — never sent automatically. Customer-facing only;
// the admin already knows, since they're the one who just changed it.
// statusChanged/sizeChanged say which of the two actually differ from what
// was last notified, so the single combined email only mentions what's new.
export async function sendBookingUpdateEmail(
  booking: BookingWithEvent,
  { statusChanged, sizeChanged }: { statusChanged: boolean; sizeChanged: boolean }
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const eventTitle = eventTitleFor(booking.event);
  const detailsBlock = eventDetailsBlock(booking.event);

  let subject: string;
  let bodyHtml: string;

  if (booking.status === "cancelled" && statusChanged) {
    // Cancellation supersedes any size change — no point telling someone
    // their headcount was updated for a booking that no longer exists.
    subject = "Booking update — It's Olam Company";
    bodyHtml = `
      <h1 style="font-size:24px;margin:0 0 16px;">Hey ${esc(booking.contactName)},</h1>
      <p style="line-height:1.6;">Your team <strong>${esc(booking.teamName)}</strong>'s slot for <strong>${eventLineFor(booking.event)}</strong> has been cancelled. Reach out if you have any questions or want to grab a spot at a future night.</p>
    `;
  } else if (statusChanged && booking.status === "confirmed") {
    subject = "You're confirmed — It's Olam Company";
    bodyHtml = `
      <h1 style="font-size:24px;margin:0 0 16px;">Locked in, ${esc(booking.contactName)}.</h1>
      <p style="line-height:1.6;">${
        sizeChanged
          ? `Your team <strong>${esc(booking.teamName)}</strong> is confirmed for <strong>${eventTitle}</strong> with <strong>${booking.teamSize} players</strong>.`
          : `Your team <strong>${esc(booking.teamName)}</strong> (${booking.teamSize} players) is confirmed for <strong>${eventTitle}</strong>.`
      }</p>
      ${detailsBlock}
      <p style="line-height:1.6;">See you there!</p>
    `;
  } else {
    // sizeChanged only (status is unchanged or still pending)
    subject = "Booking update — It's Olam Company";
    bodyHtml = `
      <h1 style="font-size:24px;margin:0 0 16px;">Hey ${esc(booking.contactName)},</h1>
      <p style="line-height:1.6;">Your team <strong>${esc(booking.teamName)}</strong>'s headcount for <strong>${eventTitle}</strong> has been updated to <strong>${booking.teamSize} players</strong>.</p>
      ${detailsBlock}
    `;
  }

  await sendOrThrow(client, { from: FROM, to: booking.email, subject, html: wrapEmail(bodyHtml) });
  return true;
}

type VenueInquiryEmail = {
  venueName: string;
  contactName: string;
  email: string;
  message: string | null;
};

export async function sendVenueInquiryEmails(inquiry: VenueInquiryEmail): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const [toCustomer, toAdmin] = await Promise.allSettled([
    sendOrThrow(client, {
      from: FROM,
      to: inquiry.email,
      subject: "We got your message — It's Olam Company",
      html: wrapEmail(`
        <h1 style="font-size:24px;margin:0 0 16px;">Thanks, ${esc(inquiry.contactName)}.</h1>
        <p style="line-height:1.6;">We've received your message about hosting a night at <strong>${esc(inquiry.venueName)}</strong>. We usually reply within a couple of days.</p>
      `),
    }),
    sendOrThrow(client, {
      from: FROM,
      to: ADMIN_TO,
      subject: `New venue inquiry: ${inquiry.venueName}`,
      html: wrapEmail(`
        <h1 style="font-size:20px;margin:0 0 16px;">New venue inquiry</h1>
        <p style="line-height:1.6;">
          <strong>${esc(inquiry.venueName)}</strong><br/>
          Contact: ${esc(inquiry.contactName)} — ${esc(inquiry.email)}<br/>
          ${inquiry.message ? `Message: ${esc(inquiry.message)}` : ""}
        </p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin" style="color:#B8451D;">Review in admin →</a></p>
      `),
    }),
  ]);
  if (toAdmin.status === "rejected") console.error("Admin notification email failed:", toAdmin.reason);
  if (toCustomer.status === "rejected") throw toCustomer.reason;
  return true;
}

// ---------------------------------------------------------------------------
// Day-before reminder + "are you still coming?" nudge. Both are sent manually
// from the admin panel (never automatically) to confirmed bookings only, and
// each carries the booking's private RSVP link.
// ---------------------------------------------------------------------------

type ReminderEvent = EmailEvent & {
  mapsUrl: string | null;
  districtUrl: string | null;
  swiggyUrl: string | null;
  reminderOfferNote: string | null;
};

type ReminderBooking = { teamName: string; contactName: string; email: string; teamSize: number };

const BUTTON_STYLE =
  "display:inline-block;background:#B8451D;color:#F5F0E6;padding:14px 22px;font-family:monospace;font-size:13px;letter-spacing:1px;text-decoration:none;text-transform:uppercase;";
const SECONDARY_BUTTON_STYLE =
  "display:inline-block;border:2px solid #1C1712;color:#1C1712;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:1px;text-decoration:none;text-transform:uppercase;margin:0 8px 8px 0;";

function shortDateText(date: Date) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: EVENT_TZ });
}

// The "lock your table" call to action. Wording comes from the admin (so a
// changed offer never needs a code change); only real http(s) links are used.
function tableBookingBlock(event: ReminderEvent) {
  const district = safeHttpUrl(event.districtUrl);
  const swiggy = safeHttpUrl(event.swiggyUrl);
  const note = event.reminderOfferNote?.trim();
  if (!note && !district && !swiggy) return "";

  const buttons = [
    district && `<a href="${esc(district)}" style="${SECONDARY_BUTTON_STYLE}">Book on District →</a>`,
    swiggy && `<a href="${esc(swiggy)}" style="${SECONDARY_BUTTON_STYLE}">Book on Swiggy Dineout →</a>`,
  ]
    .filter(Boolean)
    .join("");

  return `
    <div style="margin:20px 0;padding:16px;border:2px solid #B8451D;">
      <div style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#B8451D;text-transform:uppercase;margin-bottom:8px;">Lock your table</div>
      <p style="line-height:1.6;margin:0 0 12px;">${esc(note || "Reserve your team's table ahead of the night:")}</p>
      ${buttons}
    </div>
  `;
}

export async function sendReminderEmail(
  booking: ReminderBooking,
  event: ReminderEvent,
  rsvpUrl: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  await sendOrThrow(client, {
    from: FROM,
    to: booking.email,
    subject: `Reminder: ${event.title} — ${shortDateText(event.date)}`,
    html: wrapEmail(`
      <h1 style="font-size:24px;margin:0 0 16px;">Almost showtime, ${esc(booking.contactName)}.</h1>
      <p style="line-height:1.6;">Your team <strong>${esc(booking.teamName)}</strong> (${booking.teamSize} players) is down for <strong>${esc(event.title)}</strong>.</p>
      ${eventDetailsBlock(event, mapsLinkFor(event))}
      <p style="line-height:1.6;"><strong>Are you still coming?</strong> Tap below and tell us your final headcount. It takes ten seconds and helps us plan the night.</p>
      <p style="margin:20px 0;"><a href="${esc(rsvpUrl)}" style="${BUTTON_STYLE}">Yes, we're coming →</a></p>
      <p style="line-height:1.6;font-size:13px;color:#8C8477;">Can't make it? Use the same link and let us know.</p>
      ${tableBookingBlock(event)}
    `),
  });
  return true;
}

export async function sendNudgeEmail(
  booking: ReminderBooking,
  event: ReminderEvent,
  rsvpUrl: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  await sendOrThrow(client, {
    from: FROM,
    to: booking.email,
    subject: `Are you still coming? — ${event.title}`,
    html: wrapEmail(`
      <h1 style="font-size:24px;margin:0 0 16px;">Quick check, ${esc(booking.contactName)}.</h1>
      <p style="line-height:1.6;">We haven't heard back about <strong>${esc(event.title)}</strong> on ${eventDateText(event.date)} at ${eventTimeText(event.date)}. Is <strong>${esc(booking.teamName)}</strong> still coming?</p>
      <p style="margin:20px 0;"><a href="${esc(rsvpUrl)}" style="${BUTTON_STYLE}">Confirm or let us know →</a></p>
    `),
  });
  return true;
}
