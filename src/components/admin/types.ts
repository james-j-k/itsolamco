export type AdminEvent = {
  id: string;
  title: string;
  theme: string | null;
  date: string;
  venueName: string;
  venueArea: string;
  bookingCount: number;
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
  createdAt: string;
  eventTitle: string | null;
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
