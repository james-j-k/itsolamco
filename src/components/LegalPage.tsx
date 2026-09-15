import Link from "next/link";
import Image from "next/image";

export default function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712]">
      <nav className="sticky top-0 z-50 bg-[#F5F0E6] border-b-2 border-[#1C1712] px-8 py-4 flex items-center">
        <Link href="/">
          <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto" />
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-16 md:py-24">
        <Link href="/" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#B8451D] hover:underline">
          ← Back home
        </Link>
        <h1 className="font-display text-5xl md:text-6xl mt-6 mb-4">{title}</h1>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#8C8477] mb-16">
          Last updated: {lastUpdated}
        </p>

        <div className="legal-content text-lg leading-relaxed text-[#1C1712]/90">
          {children}
        </div>

        <div className="mt-20 pt-8 border-t border-[#1C1712]/20 font-mono text-xs text-[#8C8477]">
          Questions about this page? Write to{" "}
          <a href="mailto:itsolamco@gmail.com" className="text-[#B8451D] hover:underline">
            itsolamco@gmail.com
          </a>
          .
        </div>
      </main>

      <style>{`
        .legal-content h2 {
          font-family: var(--font-anton), sans-serif;
          text-transform: uppercase;
          letter-spacing: -0.01em;
          font-size: 1.75rem;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }
        .legal-content h3 {
          font-weight: 600;
          font-size: 1.15rem;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
        }
        .legal-content p {
          margin-bottom: 1.25rem;
        }
        .legal-content ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .legal-content li {
          margin-bottom: 0.5rem;
        }
        .legal-content a {
          color: #B8451D;
        }
        .legal-content a:hover {
          text-decoration: underline;
        }
        .legal-content strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
