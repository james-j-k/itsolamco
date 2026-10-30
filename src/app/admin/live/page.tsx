import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LiveAdmin from "@/components/live/LiveAdmin";

export const dynamic = "force-dynamic";

export default async function LiveAdminPage() {
  const [quizzes, sessions] = await Promise.all([
    prisma.liveQuiz.findMany({ orderBy: { createdAt: "desc" }, include: { rounds: { select: { _count: { select: { questions: true } } } } } }),
    prisma.liveSession.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { quiz: { select: { title: true } }, _count: { select: { teams: true } } } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin" className="font-mono text-xs text-[#B8451D] uppercase tracking-widest">
        ← Admin
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-6">Live quiz</h1>
      <LiveAdmin
        quizzes={quizzes.map((q) => ({ id: q.id, title: q.title, rounds: q.rounds.length, questions: q.rounds.reduce((n, r) => n + r._count.questions, 0) }))}
        sessions={sessions.map((s) => ({ id: s.id, code: s.code, quizTitle: s.quiz.title, teams: s._count.teams, status: s.status, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  );
}
