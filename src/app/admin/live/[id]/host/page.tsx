import LiveHost from "@/components/live/LiveHost";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live quiz host", robots: { index: false, follow: false } };

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveHost sessionId={id} />;
}
