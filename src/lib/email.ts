import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "It's Olam Company <notify@itsolamco.in>";
const ADMIN_TO = process.env.EMAIL_TO ?? "itsolamco@gmail.com";

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
  return event ? event.title : "the next available night";
}

// One-line form for sentences that don't get the full details block.
function eventLineFor(event: EmailEvent | null) {
  return event ? `${event.title} on ${eventDateText(event.date)}` : "the next available night";
}

// When and where, set apart so it's the first thing a customer looks for.
// Empty when there's no event to describe (nothing scheduled yet).
function eventDetailsBlock(event: EmailEvent | null) {
  if (!event) return "";
  return `
    <div style="margin:20px 0;padding:16px;border:1px solid rgba(28,23,18,.25);">
      <div style="font-size:17px;font-weight:bold;">${eventDateText(event.date)} · ${eventTimeText(event.date)}</div>
      <div style="font-size:14px;color:#8C8477;margin-top:4px;">${event.venueName}, ${event.venueArea}</div>
    </div>
  `;
}

// Returns whether the emails were actually sent (false when RESEND_API_KEY
// isn't configured) so callers can distinguish "skipped" from "sent".
export async function sendBookingEmails(booking: BookingWithEvent): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const eventLine = eventLineFor(booking.event);

  await Promise.all([
    client.emails.send({
      from: FROM,
      to: booking.email,
      subject: "Slot requested — It's Olam Company",
      html: wrapEmail(`
        <h1 style="font-size:24px;margin:0 0 16px;">See you there, ${booking.contactName}.</h1>
        <p style="line-height:1.6;">We've got your team <strong>${booking.teamName}</strong> (${booking.teamSize} players) down for <strong>${eventTitleFor(booking.event)}</strong>.</p>
        ${eventDetailsBlock(booking.event)}
        <p style="line-height:1.6;">We'll confirm your slot shortly.</p>
      `),
    }),
    client.emails.send({
      from: FROM,
      to: ADMIN_TO,
      subject: `New booking: ${booking.teamName}`,
      html: wrapEmail(`
        <h1 style="font-size:20px;margin:0 0 16px;">New team registered</h1>
        <p style="line-height:1.6;">
          <strong>${booking.teamName}</strong> (${booking.teamSize} players)<br/>
          Contact: ${booking.contactName} — ${booking.email}<br/>
          Event: ${eventLine}
        </p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin" style="color:#B8451D;">Review in admin →</a></p>
      `),
    }),
  ]);
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
      <h1 style="font-size:24px;margin:0 0 16px;">Hey ${booking.contactName},</h1>
      <p style="line-height:1.6;">Your team <strong>${booking.teamName}</strong>'s slot for <strong>${eventLineFor(booking.event)}</strong> has been cancelled. Reach out if you have any questions or want to grab a spot at a future night.</p>
    `;
  } else if (statusChanged && booking.status === "confirmed") {
    subject = "You're confirmed — It's Olam Company";
    bodyHtml = `
      <h1 style="font-size:24px;margin:0 0 16px;">Locked in, ${booking.contactName}.</h1>
      <p style="line-height:1.6;">${
        sizeChanged
          ? `Your team <strong>${booking.teamName}</strong> is confirmed for <strong>${eventTitle}</strong> with <strong>${booking.teamSize} players</strong>.`
          : `Your team <strong>${booking.teamName}</strong> (${booking.teamSize} players) is confirmed for <strong>${eventTitle}</strong>.`
      }</p>
      ${detailsBlock}
      <p style="line-height:1.6;">See you there!</p>
    `;
  } else {
    // sizeChanged only (status is unchanged or still pending)
    subject = "Booking update — It's Olam Company";
    bodyHtml = `
      <h1 style="font-size:24px;margin:0 0 16px;">Hey ${booking.contactName},</h1>
      <p style="line-height:1.6;">Your team <strong>${booking.teamName}</strong>'s headcount for <strong>${eventTitle}</strong> has been updated to <strong>${booking.teamSize} players</strong>.</p>
      ${detailsBlock}
    `;
  }

  await client.emails.send({ from: FROM, to: booking.email, subject, html: wrapEmail(bodyHtml) });
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

  await Promise.all([
    client.emails.send({
      from: FROM,
      to: inquiry.email,
      subject: "We got your message — It's Olam Company",
      html: wrapEmail(`
        <h1 style="font-size:24px;margin:0 0 16px;">Thanks, ${inquiry.contactName}.</h1>
        <p style="line-height:1.6;">We've received your message about hosting a night at <strong>${inquiry.venueName}</strong>. We usually reply within a couple of days.</p>
      `),
    }),
    client.emails.send({
      from: FROM,
      to: ADMIN_TO,
      subject: `New venue inquiry: ${inquiry.venueName}`,
      html: wrapEmail(`
        <h1 style="font-size:20px;margin:0 0 16px;">New venue inquiry</h1>
        <p style="line-height:1.6;">
          <strong>${inquiry.venueName}</strong><br/>
          Contact: ${inquiry.contactName} — ${inquiry.email}<br/>
          ${inquiry.message ? `Message: ${inquiry.message}` : ""}
        </p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin" style="color:#B8451D;">Review in admin →</a></p>
      `),
    }),
  ]);
  return true;
}
