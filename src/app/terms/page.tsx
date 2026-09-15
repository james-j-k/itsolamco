import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | It's Olam Company",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="September 14, 2026">
      <p>
        These terms cover your use of itsolamco.in (the &quot;Site&quot;), run by It&apos;s Olam
        Company (&quot;we&quot;, &quot;us&quot;), a Kochi-based events outfit hosting Malayalam
        pop-culture and Mollywood trivia nights in pubs and restobars. By using the Site, you agree
        to these terms.
      </p>

      <h2>What the Site Is</h2>
      <p>
        The Site is an information and interest-registration page for our quiz nights. It lists
        upcoming events, explains our round format, and lets you:
      </p>
      <ul>
        <li>Register interest in attending a quiz night as a team, or</li>
        <li>Get in touch as a venue interested in hosting a night.</li>
      </ul>
      <p>
        Submitting a form on the Site is an <strong>expression of interest</strong>, not a confirmed
        reservation, ticket, or contract. Final RSVP, table booking, and any payment (for food,
        drinks, or entry, where applicable) happen directly with the host venue or through our
        official Instagram, not through this Site.
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
        between you and the venue.
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
        <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
