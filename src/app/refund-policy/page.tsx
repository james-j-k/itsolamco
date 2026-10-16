import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { BUSINESS, TICKET_POLICY } from "@/lib/business";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | It's Olam Company",
  description: `How tickets, cancellations and refunds work for ${BUSINESS.brand} quiz nights in Kochi.`,
};

const P = TICKET_POLICY;

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" lastUpdated="October 16, 2026">
      <p>
        This policy explains what you&apos;re paying for when you buy a ticket to one of our quiz nights, and
        what happens if you can&apos;t make it. It applies to tickets bought on itsolamco.in (the &quot;Site&quot;).
        Our nights are run by {BUSINESS.brand}, operated by {BUSINESS.operator}, {BUSINESS.operatorRole}.
      </p>

      <div className="mb-10 border-2 border-[#1C1712] bg-[#EEE7D8] p-5 md:p-6">
        <div className="mb-3 font-mono text-xs tracking-[0.25em] text-[#A63D17]">THE SHORT VERSION</div>
        <ul className="!mb-0 !pl-5 !text-base">
          <li>
            Your ticket is for <strong>entry to the quiz night</strong>. It is separate from anything the pub charges.
          </li>
          <li>
            Cancel <strong>{P.refundCutoffHours} hours or more</strong> before the start: get a <strong>{P.refundPercent}% refund</strong>, or a{" "}
            <strong>{P.creditPercent}% credit</strong> for a future night.
          </li>
          <li>
            Cancel <strong>less than {P.refundCutoffHours} hours</strong> before, or don&apos;t show up: <strong>no refund</strong>. You can still
            pass your spot to a friend.
          </li>
          <li>
            If <strong>we</strong> cancel or move the night: <strong>full refund</strong>, or a full credit if you prefer.
          </li>
        </ul>
      </div>

      <h2>1. What your ticket covers</h2>
      <p>
        The ticket price shown when you register is the price of <strong>entry to the quiz night</strong> for each person in your team. It is paid to{" "}
        {BUSINESS.brand} and pays for running the night: hosting, questions, scoring and prizes.
      </p>
      <p>
        It does <strong>not</strong> include food or drinks.
      </p>

      <h2>2. The pub&apos;s own entry fee</h2>
      <p>
        Some of the pubs and restobars that host our nights may charge their own entry or cover fee, and some may not. When a venue does,
        it is set and collected <strong>by the venue</strong> at the door, and it is normally <strong>fully redeemable</strong> against food and drinks
        that night. We show what we know about it on the registration screen.
      </p>
      <p>
        That fee is between you and the venue. It is not part of your ticket, we don&apos;t collect it, and we can&apos;t refund it. Any questions about
        it should go to the venue.
      </p>

      <h2>3. If you cancel</h2>
      <p>
        Time is counted from the start time published for that night (Indian Standard Time) to the moment we receive your cancellation request.
      </p>
      <h3>{P.refundCutoffHours} hours or more before the night</h3>
      <p>You can choose one of:</p>
      <ul>
        <li>
          a <strong>{P.refundPercent}% refund</strong> of the ticket price you paid, to the payment method you used, or
        </li>
        <li>
          a <strong>{P.creditPercent}% credit</strong> toward a ticket for a future night, valid for {P.creditValidDays} days from the date we issue it.
        </li>
      </ul>
      <h3>Less than {P.refundCutoffHours} hours before the night</h3>
      <p>
        The ticket is <strong>not refundable</strong> and no credit is issued. Places are limited and we plan the night around the headcount, so late
        cancellations leave a seat empty that someone else could have had.
      </p>

      <h2>4. Passing your spot to someone else</h2>
      <p>
        You can transfer your ticket to another person at any time before the night starts, even inside the {P.refundCutoffHours}-hour window. Email us
        with your team name and the new person&apos;s name and we&apos;ll update the booking. A transfer is not a refund.
      </p>

      <h2>5. Not turning up</h2>
      <p>If you don&apos;t arrive for the night, or arrive after the quiz has started and can&apos;t be seated, the ticket is not refundable.</p>

      <h2>6. If we cancel or change the night</h2>
      <p>
        If we cancel a night, or move it to a different date, you can choose a <strong>full refund</strong> of your ticket price or a{" "}
        <strong>full credit</strong> for another night. If we change the venue to one you can&apos;t attend, the same choice applies. We&apos;ll tell
        you by email and on Instagram as soon as we know.
      </p>

      <h2>7. Venue rules</h2>
      <p>
        Our nights are held in licensed bars and restobars. The venue&apos;s rules and the law apply, including any age or ID requirements for being
        on the premises or being served alcohol. If you&apos;re refused entry because you don&apos;t meet those requirements, the ticket is not
        refundable.
      </p>

      <h2>8. How to ask for a refund, credit or transfer</h2>
      <p>
        Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> from the address you booked with, or message us on Instagram (
        <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer">
          {BUSINESS.instagramHandle}
        </a>
        ). Please include:
      </p>
      <ul>
        <li>your team name and the name on the booking</li>
        <li>the night you booked</li>
        <li>what you&apos;d like: refund, credit, or transfer</li>
      </ul>
      <p>We reply within {BUSINESS.replyWithinHours} hours.</p>

      <h2>9. How refunds are paid</h2>
      <p>
        Approved refunds go back to the <strong>same payment method</strong> you paid with. We start the refund within{" "}
        {P.refundInitiatedWithinBusinessDays} business days of approving it, and banks usually take a further {P.refundReachesBankWithinBusinessDays}{" "}
        business days to show it. If it hasn&apos;t arrived after that, email us and we&apos;ll trace it with you.
      </p>

      <h2>10. Failed or duplicate payments</h2>
      <p>
        If money was taken from your account but you didn&apos;t get a booking confirmation, or you were charged twice for the same booking, email us
        with the payment details. A payment that didn&apos;t result in a confirmed booking, or an accidental duplicate, is refunded in full.
      </p>

      <h2>11. Problems and complaints</h2>
      <p>
        If something went wrong and this policy doesn&apos;t cover it, please tell us before taking it to your bank. Most issues are quick to sort out.
        You can write to {BUSINESS.operator}, {BUSINESS.operatorRole}, at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. Our full contact
        details are on the <Link href="/contact">Contact page</Link>.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        We may update this policy as we grow. The version in force on the day you buy your ticket is the one that applies to it. Please also read our{" "}
        <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
