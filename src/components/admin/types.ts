export type AdminEvent = {
  id: string;
  title: string;
  theme: string | null;
  date: string;
  venueName: string;
  venueArea: string;
  bookingCount: number;
  mapsUrl: string | null;
  districtUrl: string | null;
  swiggyUrl: string | null;
  reminderOfferNote: string | null;
};

export type AdminBooking = {
  id: string;
  teamName: string;
  contactName: string;
  email: string;
  phone: string | null;
  teamSize: number;
  message: string | null;
  status: string;
  isRead: boolean;
  emailSent: boolean;
  statusEmailSentFor: string | null;
  teamSizeEmailSentFor: number | null;
  createdAt: string;
  eventTitle: string | null;
  eventId: string | null;
  rsvpStatus: string | null; // "coming" | "declined" | null (no reply)
  rsvpHeadcount: number | null;
  rsvpTableBooked: boolean | null;
  rsvpAt: string | null; // when they last replied; used to spot new replies
  reminderSentAt: string | null;
  nudgeSentAt: string | null;
  attended: boolean;
  source: string; // "website" | "ticketing"
};

export type AdminInquiry = {
  id: string;
  venueName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
};

export type AdminRound = {
  id: string;
  order: number;
  title: string;
  description: string;
};

export type AdminVenue = {
  id: string;
  order: number;
  name: string;
  area: string | null;
};
