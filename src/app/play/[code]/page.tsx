import LivePlay from "@/components/live/LivePlay";
import { liveThemeOf } from "@/lib/liveQuiz";
import { faloodaLiveFonts } from "@/lib/liveFaloodaFonts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the quiz", robots: { index: false, follow: false } };

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const theme = await liveThemeOf({ code: clean });
  return (
    <div className={theme === "falooda" ? faloodaLiveFonts : undefined}>
      <LivePlay code={clean} theme={theme} />
    </div>
  );
}
