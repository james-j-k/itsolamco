import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Contact Us | It's Olam Company",
  description: `Contact ${BUSINESS.brand}, Kochi: tickets, refunds, venues and general questions.`,
};

const card = "block border-2 border-[#1C1712] p-5 transition-colors hover:bg-[#EEE7D8] active:bg-[#EEE7D8] no-underline";
const label = "mb-1 font-mono text-xs tracking-[0.25em] text-[#B8451D]";
const value = "font-display text-2xl break-words text-[#1C1712]";

export default function ContactPage() {
  const phoneDigits = BUSINESS.phone.replace(/[^\d+]/g, "");

  return (
    <LegalPage title="Contact Us">
      <p>
        Questions about a night, a ticket, a refund, or hosting us at your venue? Write to us and we&apos;ll reply within{" "}
        {BUSINESS.replyWithinHours} hours.
      </p>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a href={`mailto:${BUSINESS.email}`} className={card}>
          <div className={label}>EMAIL</div>
          <div className={`${value} normal-case`}>{BUSINESS.email}</div>
        </a>
        {BUSINESS.phone && (
          <a href={`tel:${phoneDigits}`} className={card}>
            <div className={label}>PHONE</div>
            <div className={value}>{BUSINESS.phone}</div>
          </a>
        )}
        <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer" className={card}>
          <div className={label}>INSTAGRAM</div>
          <div className={value}>{BUSINESS.instagramHandle}</div>
        </a>
        <a href={BUSINESS.xUrl} target="_blank" rel="noopener noreferrer" className={card}>
          <div className={label}>X</div>
          <div className={value}>{BUSINESS.xHandle}</div>
        </a>
      </div>

      <h2>About a ticket or refund</h2>
      <p>
        Email us from the address you booked with and include your team name and the night you booked. Our{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> explains what you&apos;re entitled to.
      </p>

      <h2>Hosting a night</h2>
      <p>
        Own or run a pub or restobar in Kochi? Use the <Link href="/#partner">Host a Night</Link> form on our home page, or email us.
      </p>

      <h2>Who we are</h2>
      <ul>
        <li>
          <strong>Business name:</strong> {BUSINESS.brand}
        </li>
        <li>
          <strong>Operated by:</strong> {BUSINESS.operator}, {BUSINESS.operatorRole}
        </li>
        <li>
          <strong>Based in:</strong> {BUSINESS.location}
        </li>
        <li>
          <strong>Website:</strong> {BUSINESS.siteUrl.replace("https://", "")}
        </li>
      </ul>

      <h2>Complaints</h2>
      <p>
        If something went wrong, write to {BUSINESS.operator}, {BUSINESS.operatorRole}, at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. We
        read every message and will respond within {BUSINESS.replyWithinHours} hours.
      </p>
    </LegalPage>
  );
}
