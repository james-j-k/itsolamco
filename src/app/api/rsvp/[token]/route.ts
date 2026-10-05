import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rsvpSchema } from "@/lib/validation";
import { isRateLimited } from "@/lib/rateLimit";

type Params = { params: Promise<{ token: string }> };

// Public: the unguessable token in the URL is the only credential, so a
// customer can answer from the email without logging in. Looking at the RSVP
// *page* never records anything — only this POST (a deliberate button press)
// does, so email link-scanners that open URLs can't confirm anyone by accident.
export async function POST(request: NextRequest, { params }: Params) {
  // More lenient than the signup forms: a whole room can share one venue Wi-Fi.
  if (isRateLimited(request, "rsvp", 30)) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  const { token } = await params;
  const parsed = rsvpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // The form never sends these, so they only appear if someone tampers or
    // the page is stale — keep the wording human rather than a raw schema error.
    const issue = parsed.error.issues[0];
    const message =
      issue?.path[0] === "headcount"
        ? issue.message === "Tell us how many players are coming"
          ? issue.message
          : "Players must be a whole number between 1 and 15."
        : "Something looked off with that answer. Please reload the page and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { response, headcount, tableBooked } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { rsvpToken: token },
    include: { event: { select: { date: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }
  if (booking.event && booking.event.date.getTime() < Date.now()) {
    return NextResponse.json({ error: "This night has already happened." }, { status: 410 });
  }

  const coming = response === "coming";
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      rsvpStatus: response,
      rsvpHeadcount: coming ? headcount : null,
      // null = they skipped the optional question (not the same as "no").
      rsvpTableBooked: coming ? (tableBooked ?? null) : null,
      rsvpAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
