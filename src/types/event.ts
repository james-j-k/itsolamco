export type EventDTO = {
  id: string;
  title: string;
  theme: string | null;
  date: string; // ISO string
  venueName: string;
  venueArea: string;
  teamsBooked: number;
  externalUrl?: string | null; // tickets are sold on another site; RSVP buttons go there
  externalLabel?: string | null; // that site's name, for the button
};
