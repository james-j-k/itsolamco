import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | It's Olam Company",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="October 16, 2026">
      <p>
        These terms cover your use of itsolamco.in (the &quot;Site&quot;), run by It&apos;s Olam
        Company (&quot;we&quot;, &quot;us&quot;), a Kochi-based events outfit hosting Malayalam
        pop-culture and Mollywood trivia nights in pubs and restobars. By using the Site, you agree
        to these terms.
      </p>

      <h2>What the Site Is</h2>
      <p>
        The Site lists our upcoming quiz nights, explains our round format, and lets you:
      </p>
      <ul>
        <li>Register a team for a quiz night (free or ticketed, as shown for each night), or</li>
        <li>Get in touch as a venue interested in hosting a night.</li>
      </ul>
      <p>
        For a night that is <strong>free to register</strong>, submitting the form is an{" "}
        <strong>expression of interest</strong>, not a confirmed reservation. Final RSVP, table
        booking, and headcount are confirmed with you closer to the night.
      </p>

      <h2>Tickets and Payments</h2>
      <p>
        Some nights are <strong>ticketed</strong>. The ticket price, shown when you register, is the price of{" "}
        <strong>entry to the quiz night</strong> for each person in your team. It is paid to It&apos;s Olam Company and
        does not include food or drinks. A ticketed booking is confirmed once your payment has been received
        and checked, and we&apos;ll email you when it is.
      </p>
      <p>
        Some host venues may charge their own entry or cover fee, which is set and collected by the venue
        and is normally redeemable against food and drinks. That fee is separate from your ticket.
      </p>
      <p>
        Cancellations, refunds, credits, and transfers are covered by our{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>, which forms part of these terms.
        Payments may be handled through a third-party payment provider; we never see or store your card or
        bank login details.
      </p>

      <h2>Event Details</h2>
      <p>
        Dates, times, themes, and venues are set by us and our host venues and can change on short
        notice. We&apos;ll do our best to keep the Site current, but always confirm details with the
        venue or our Instagram before heading out.
      </p>

      <h2>Using the Site</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Submit false, misleading, or spam submissions through our forms</li>
        <li>Use automated tools to scrape, flood, or abuse the Site or its forms</li>
        <li>Attempt to access the admin area without authorization</li>
        <li>Use any content from the Site for commercial purposes without our permission</li>
      </ul>

      <h2>Our Content</h2>
      <p>
        Our name, logo, round formats, and trivia questions are our own work (or used
        with permission) and stay our property. You&apos;re welcome to share pages of this Site, but
        please don&apos;t reproduce our content elsewhere without asking first.
      </p>

      <h2>Host Venues</h2>
      <p>
        Quiz nights take place at independently owned pubs and restobars. We aren&apos;t responsible
        for the venue&apos;s own service, food, drinks, pricing, seating, or house policies — that&apos;s
        between you and the venue. The venue&apos;s rules and the law apply on its premises, including any
        age or ID requirements.
      </p>

      <h2>Photos and Video</h2>
      <p>
        We may take photos and video at our nights and share them on the Site and our social accounts. If
        you would like a photo or clip of you removed, email us and we&apos;ll take it down.
      </p>

      <h2>No Warranty</h2>
      <p>
        The Site and its content are provided &quot;as is&quot;. We don&apos;t guarantee the Site will
        be error-free, uninterrupted, or that event details will always be perfectly up to date.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the extent permitted by law, we aren&apos;t liable for any indirect loss
        arising from your use of the Site, attendance at an event, or reliance on information listed
        here. Nothing in these terms limits liability where it can&apos;t legally be limited.
      </p>

      <h2>Governing Law</h2>
      <p>
        These terms are governed by the laws of India, and any disputes are subject to the
        jurisdiction of the courts in Kochi, Kerala.
      </p>

      <h2>Changes to These Terms</h2>
      <p>
        We may update these terms as the business grows. We&apos;ll update the date at the top of
        this page when we do.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms — reach us at{" "}
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>, or see our{" "}
        <Link href="/contact">Contact page</Link>.
      </p>
    </LegalPage>
  );
}
