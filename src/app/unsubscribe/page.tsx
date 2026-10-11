import type { Metadata } from "next";
import Link from "next/link";
import RecapShell from "@/components/RecapShell";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

// Private, per-person link: keep it out of search results.
export const metadata: Metadata = { title: "Stop emails | It's Olam Company", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ e?: string; t?: string; done?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const { e = "", t = "", done } = await searchParams;
  const valid = verifyUnsubscribeToken(e, t);
  const email = valid ? normalizeEmail(e) : "";
  const alreadyOut = valid ? !!(await prisma.emailOptOut.findUnique({ where: { email } })) : false;

  return (
    <RecapShell>
      <div className="mx-auto max-w-lg border-2 border-[#1C1712] p-6 sm:p-8">
        {!valid ? (
          <>
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-[#B8451D]">HMM</div>
            <h1 className="mb-4 font-display text-4xl">THAT LINK DOESN&apos;T WORK.</h1>
            <p className="text-[#6A6357]">
              It may have been cut short when it was copied. Open it again from the email, or message us on Instagram (@itsolamco) and we&apos;ll
              take you off the list.
            </p>
          </>
        ) : done || alreadyOut ? (
          <>
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-[#B8451D]">DONE</div>
            <h1 className="mb-4 font-display text-4xl">YOU&apos;RE OFF THE LIST.</h1>
            <p className="mb-6 text-[#6A6357]">
              We won&apos;t email <strong className="text-[#1C1712]">{email}</strong> about new nights. If you book a night, you&apos;ll still get the
              confirmation and reminder for that booking.
            </p>
            <Link href="/" className="inline-flex min-h-11 items-center font-mono text-xs tracking-[0.2em] text-[#B8451D] underline underline-offset-4">
              BACK TO THE SITE →
            </Link>
          </>
        ) : (
          <>
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-[#B8451D]">NEW NIGHT EMAILS</div>
            <h1 className="mb-4 font-display text-4xl">STOP THESE EMAILS?</h1>
            <p className="mb-6 text-[#6A6357]">
              We&apos;ll stop emailing <strong className="text-[#1C1712]">{email}</strong> when a new night is announced.
            </p>
            <form method="POST" action="/api/unsubscribe">
              <input type="hidden" name="e" value={email} />
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="btn-rust w-full py-4 font-display text-xl">
                YES, STOP THEM
              </button>
            </form>
            <Link href="/" className="mt-3 inline-flex min-h-11 items-center font-mono text-xs tracking-[0.2em] underline underline-offset-4">
              NO, TAKE ME TO THE SITE
            </Link>
          </>
        )}
      </div>
    </RecapShell>
  );
}
