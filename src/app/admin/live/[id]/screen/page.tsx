import LiveScreen from "@/components/live/LiveScreen";
import { createLivePass } from "@/lib/liveKey";
import { liveThemeOf } from "@/lib/liveQuiz";
import { faloodaLiveFonts } from "@/lib/liveFaloodaFonts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live quiz screen", robots: { index: false, follow: false } };

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = await liveThemeOf({ id });
  const pass = await createLivePass(id);
  return (
    <div className={theme === "falooda" ? faloodaLiveFonts : undefined}>
      <LiveScreen sessionId={id} theme={theme} pass={pass} />
    </div>
  );
}
