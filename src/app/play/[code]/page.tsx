import LivePlay from "@/components/live/LivePlay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the quiz", robots: { index: false, follow: false } };

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LivePlay code={code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)} />;
}
