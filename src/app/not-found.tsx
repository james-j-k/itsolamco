import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712] flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-10">
        <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto" />
      </Link>
      <div className="font-mono text-[#B8451D] text-[11px] tracking-[0.28em] uppercase mb-4">404</div>
      <h1 className="font-display text-5xl md:text-6xl mb-4">THAT ROUND DOESN&apos;T EXIST.</h1>
      <p className="text-[#8C8477] max-w-md mb-10 leading-relaxed">
        This page wandered off before the quiz started. Let&apos;s get you back to the action.
      </p>
      <Link href="/" className="btn-rust px-8 py-3 font-display text-lg">
        BACK TO HOME
      </Link>
    </div>
  );
}
