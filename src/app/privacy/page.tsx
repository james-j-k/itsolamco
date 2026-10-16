import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | It's Olam Company",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 16, 2026">
      <p>
        It&apos;s Olam Company (&quot;we&quot;, &quot;us&quot;) runs Malayalam pop-culture and
        Mollywood trivia nights in pubs and restobars across Kochi. This page explains what
        information we collect through itsolamco.in (the &quot;Site&quot;), why we collect it, and
        what we do with it.
      </p>

      <h2>Information We Collect</h2>
      <p>We only collect information you choose to give us, through the forms on the Site:</p>
      <h3>When you register a team for a quiz night</h3>
      <ul>
        <li>Team name</li>
        <li>Your name</li>
        <li>Email address</li>
        <li>Phone number (optional)</li>
        <li>Team size</li>
        <li>Any message you add</li>
        <li>For ticketed nights: a record of your payment (such as the amount, status, and payment reference)</li>
        <li>If you reply to a reminder: whether you&apos;re coming and how many people</li>
      </ul>
      <p>
        We do <strong>not</strong> see or store your card details, UPI PIN, or bank login. Payments are
        handled by a payment provider, and we only receive a confirmation and a reference.
      </p>
      <h3>When you contact us as a venue (&quot;Host a Night&quot;)</h3>
      <ul>
        <li>Venue name</li>
        <li>Your name</li>
        <li>Email address</li>
        <li>Phone number (optional)</li>
        <li>Any message you add</li>
      </ul>
      <p>
        We use <strong>Vercel Web Analytics</strong> to count visits and see which pages are used. It
        doesn&apos;t use cookies and doesn&apos;t track you across other sites. We don&apos;t use advertising
        trackers, and we don&apos;t set any cookies for visitors. (Our own staff login for managing events
        uses one cookie to stay signed in — that never applies to regular visitors.)
      </p>

      <h2>How We Use It</h2>
      <ul>
        <li>To follow up with you about a quiz night or a venue partnership</li>
        <li>To plan headcounts and logistics for events</li>
        <li>To send you a short confirmation email when you submit a form, and a reminder before the night</li>
        <li>To confirm your ticket payment, and to handle refunds, credits, and transfers</li>
        <li>To tell people who came to an earlier night about a new one (see below)</li>
      </ul>
      <p>
        For a night that is free to register, submitting the form registers your <strong>interest</strong>{" "}
        only — final RSVP and headcount are confirmed closer to the night. For a ticketed night, your
        booking is confirmed once your payment has been received and checked.
      </p>
      <h3>Emails about new nights</h3>
      <p>
        If you came to or booked an earlier night, we may email you once about a new night. Every such
        email has an unsubscribe link. If you use it, we won&apos;t send you those emails again (you&apos;ll still
        get the emails about a booking you make).
      </p>

      <h2>Who We Share It With</h2>
      <p>We use a small number of service providers to run the Site. Each handles your information only to do its job:</p>
      <ul>
        <li>
          <strong>Resend</strong> sends our emails (it sees your name and email address).
        </li>
        <li>
          <strong>Vercel</strong> hosts the Site and provides cookie-free visit counts.
        </li>
        <li>
          <strong>Neon</strong> stores our booking database.
        </li>
        <li>
          <strong>Razorpay</strong>, where a night has paid tickets, processes the payment. It handles your payment
          details under its own privacy policy.
        </li>
      </ul>
      <p>
        The host venue may be told your team name and headcount so it can plan the night. We don&apos;t sell or
        rent your information to anyone.
      </p>

      <h2>Photos and Video</h2>
      <p>
        We may take photos and video at our nights and share them on the Site and our social accounts. If you
        would like something removed, email us and we&apos;ll take it down.
      </p>

      <h2>How Long We Keep It</h2>
      <p>
        We keep booking and inquiry records for as long as reasonably useful for running events and
        following up with venues and teams — generally no more than a couple of years, unless you
        ask us to delete it sooner.
      </p>

      <h2>Your Rights</h2>
      <p>
        You can ask us what information we hold about you, ask us to correct it, or ask us to delete
        it, at any time, by emailing{" "}
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>. We&apos;ll respond within two days.
      </p>

      <h2>Children</h2>
      <p>
        Our events are pub quiz nights held in licensed bars and restobars. The Site isn&apos;t
        directed at children, and we don&apos;t knowingly collect information from anyone under 18.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        If this policy changes, we&apos;ll update the date at the top of this page. Significant
        changes will be reflected here before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data or this policy — reach us at{" "}
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>, or see our{" "}
        <Link href="/contact">Contact page</Link>. Our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> covers
        tickets.
      </p>
    </LegalPage>
  );
}
