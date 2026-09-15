"use client";

import Link from "next/link";
import Image from "next/image";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712] flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-10">
        <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto" />
      </Link>
      <div className="font-mono text-[#B8451D] text-[11px] tracking-[0.28em] uppercase mb-4">SOMETHING BROKE</div>
      <h1 className="font-display text-5xl md:text-6xl mb-4">TECHNICAL FOUL.</h1>
      <p className="text-[#8C8477] max-w-md mb-10 leading-relaxed">
        Something went wrong loading this page. Try again, or head back home.
      </p>
      <div className="flex gap-4">
        <button onClick={() => reset()} className="btn-rust px-8 py-3 font-display text-lg">
          TRY AGAIN
        </button>
        <Link
          href="/"
          className="border-2 border-[#1C1712] px-8 py-3 font-display text-lg hover:bg-[#1C1712] hover:text-[#F5F0E6] transition-colors"
        >
          HOME
        </Link>
      </div>
    </div>
  );
}
