// Business and policy details shown on the Contact and Refund pages (and
// quoted in the Terms and Privacy pages). Keep them here, in one place, so the
// pages never disagree with each other.

export const BUSINESS = {
  brand: "It's Olam Company",
  operator: "James J Koduppanapolackal",
  operatorRole: "Founder",
  email: "itsolamco@gmail.com",
  // Shown on the Contact page only when filled in (e.g. "+91 98765 43210").
  phone: "",
  location: "Kochi, Kerala, India",
  siteUrl: "https://itsolamco.in",
  instagramUrl: "https://www.instagram.com/itsolamco/",
  instagramHandle: "@itsolamco",
  xUrl: "https://x.com/itsOlamco",
  xHandle: "@itsOlamco",
  // How quickly we promise to reply to a question or a refund request.
  replyWithinHours: 48,
};

// The ticket rules. The Refund Policy page is written from these numbers.
export const TICKET_POLICY = {
  refundPercent: 50,
  refundCutoffHours: 24,
  creditPercent: 100,
  creditValidDays: 90,
  refundInitiatedWithinBusinessDays: 3,
  refundReachesBankWithinBusinessDays: "5 to 7",
};
