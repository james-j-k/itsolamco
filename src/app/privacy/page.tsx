import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | It's Olam Company",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="September 14, 2026">
      <p>
        It&apos;s Olam Company (&quot;we&quot;, &quot;us&quot;) runs Malayalam pop-culture and
        Mollywood trivia nights in pubs and restobars across Kochi. This page explains what
        information we collect through itsolamco.in (the &quot;Site&quot;), why we collect it, and
        what we do with it.
      </p>

      <h2>Information We Collect</h2>
      <p>We only collect information you choose to give us, through two forms on the Site:</p>
      <h3>When you register interest in a quiz night (&quot;I&apos;m Interested&quot;)</h3>
      <ul>
        <li>Team name</li>
        <li>Your name</li>
        <li>Email address</li>
        <li>Phone number (optional)</li>
        <li>Team size</li>
        <li>Any message you add</li>
      </ul>
      <h3>When you contact us as a venue (&quot;Host a Night&quot;)</h3>
      <ul>
        <li>Venue name</li>
        <li>Your name</li>
        <li>Email address</li>
        <li>Phone number (optional)</li>
        <li>Any message you add</li>
      </ul>
      <p>
        We don&apos;t use analytics or advertising trackers on the Site, and we don&apos;t set any cookies
        for visitors. (Our own staff login for managing events uses one cookie to stay signed in —
        that never applies to regular visitors.)
      </p>

      <h2>How We Use It</h2>
      <ul>
        <li>To follow up with you about a quiz night or a venue partnership</li>
        <li>To plan headcounts and logistics for events</li>
        <li>To send you a short confirmation email when you submit a form</li>
      </ul>
      <p>
        Submitting either form registers your <strong>interest</strong> only — it is not a confirmed
        booking. Final RSVP, table confirmation, and headcount happen directly with the host venue
        or via our Instagram, closer to the night.
      </p>

      <h2>Who We Share It With</h2>
      <p>
        We use <strong>Resend</strong>, a transactional email provider, to send confirmation emails.
        Resend processes your name and email address only to deliver that email. We don&apos;t sell,
        rent, or share your information with anyone else, and we don&apos;t use it for marketing
        without asking you first.
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
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>. We&apos;ll respond as quickly as
        we can.
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
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
