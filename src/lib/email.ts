import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "It's Olam Company <onboarding@resend.dev>";
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
  event: { title: string; date: Date } | null;
};

export async function sendBookingEmails(booking: BookingWithEvent) {
  const client = getClient();
  if (!client) return;

  const eventLine = booking.event
    ? `${booking.event.title} — ${new Date(booking.event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
    : "the next available night";

  await Promise.all([
    client.emails.send({
      from: FROM,
      to: booking.email,
      subject: "Slot requested — It's Olam Company",
      html: wrapEmail(`
        <h1 style="font-size:24px;margin:0 0 16px;">See you there, ${booking.contactName}.</h1>
        <p style="line-height:1.6;">We've got your team <strong>${booking.teamName}</strong> (${booking.teamSize} players) down for <strong>${eventLine}</strong>. We'll confirm your slot shortly.</p>
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
}

type VenueInquiryEmail = {
  venueName: string;
  contactName: string;
  email: string;
  message: string | null;
};

export async function sendVenueInquiryEmails(inquiry: VenueInquiryEmail) {
  const client = getClient();
  if (!client) return;

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
}
