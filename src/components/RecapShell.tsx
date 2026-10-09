import Link from "next/link";
import Image from "next/image";

// Shared frame (logo bar + page width) for the public "Past nights" pages.
export default function RecapShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712]">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b-2 border-[#1C1712] bg-[#F5F0E6] px-6 py-4 md:px-8">
        <Link href="/">
          <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto" />
        </Link>
        <Link href="/nights" className="flex min-h-11 items-center font-mono text-xs tracking-[0.2em] uppercase hover:text-[#B8451D]">
          Past nights
        </Link>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-20">{children}</main>
    </div>
  );
}
