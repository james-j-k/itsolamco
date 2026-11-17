import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nightEndsAt, nightInfoFrom } from "@/lib/featuredNight";

// "Add to calendar" for any night: a standard calendar file. Phones open it straight into their calendar app.
// It holds only public details about the night (never anyone's booking).
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Calendar files escape backslashes, commas, semicolons and line breaks inside text values
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => "\\" + c)
    .replace(/\r?\n/g, "\\n");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Night not found" }, { status: 404 });

  const n = nightInfoFrom(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//It's Olam Company//Quiz Night//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${n.id}@itsolamco.in`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(n.startsAt)}`,
    `DTEND:${stamp(nightEndsAt(n.startsAt))}`,
    `SUMMARY:${esc(`${n.title} at ${n.venueName}`)}`,
    `LOCATION:${esc(`${n.venueName}, ${n.venueArea}, ${n.city}`)}`,
    `DESCRIPTION:${esc("Bring your gang and your Mollywood memory. It's Olam Company.")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quiz-night.ics"',
      "Cache-Control": "no-store",
    },
  });
}
