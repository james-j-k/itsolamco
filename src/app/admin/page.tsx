import { prisma } from "@/lib/prisma";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [events, bookings, inquiries, rounds, venues] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "asc" },
      include: { _count: { select: { bookings: true } } },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      include: { event: { select: { title: true, date: true } } },
    }),
    prisma.venueInquiry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.quizRound.findMany({ orderBy: { order: "asc" } }),
    prisma.venue.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <AdminDashboard
      initialEvents={events.map((e) => ({
        id: e.id,
        title: e.title,
        theme: e.theme,
        date: e.date.toISOString(),
        venueName: e.venueName,
        venueArea: e.venueArea,
        bookingCount: e._count.bookings,
      }))}
      initialBookings={bookings.map((b) => ({
        id: b.id,
        teamName: b.teamName,
        contactName: b.contactName,
        email: b.email,
        phone: b.phone,
        teamSize: b.teamSize,
        message: b.message,
        status: b.status,
        isRead: b.isRead,
        createdAt: b.createdAt.toISOString(),
        eventTitle: b.event?.title ?? null,
      }))}
      initialInquiries={inquiries.map((i) => ({
        id: i.id,
        venueName: i.venueName,
        contactName: i.contactName,
        email: i.email,
        phone: i.phone,
        message: i.message,
        status: i.status,
        isRead: i.isRead,
        createdAt: i.createdAt.toISOString(),
      }))}
      initialRounds={rounds.map((r) => ({
        id: r.id,
        order: r.order,
        title: r.title,
        description: r.description,
      }))}
      initialVenues={venues.map((v) => ({
        id: v.id,
        order: v.order,
        name: v.name,
        area: v.area,
      }))}
    />
  );
}
