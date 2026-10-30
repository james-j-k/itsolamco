import LiveScreen from "@/components/live/LiveScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live quiz screen", robots: { index: false, follow: false } };

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveScreen sessionId={id} />;
}
