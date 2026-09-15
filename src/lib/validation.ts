import { z } from "zod";

// Anti-spam fields shared by every public form:
// - `website` is a honeypot: invisible to real users, bots tend to fill every field.
// - `formRenderedAt` is a client timestamp; a submit faster than a human can act is almost always a bot.
export const antiSpamSchema = z.object({
  website: z.string().max(200).optional().or(z.literal("")),
  formRenderedAt: z.coerce.number().optional(),
});

const MIN_SUBMIT_MS = 1500;

export function isLikelyBot(data: { website?: string; formRenderedAt?: number }) {
  if (data.website && data.website.trim() !== "") return true;
  if (data.formRenderedAt && Date.now() - data.formRenderedAt < MIN_SUBMIT_MS) return true;
  return false;
}

export const bookingSchema = z.object({
  teamName: z.string().trim().min(1, "Team name is required").max(120),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  teamSize: z.coerce.number().int().min(1).max(15).default(1),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
  eventId: z.string().trim().optional().or(z.literal("")),
}).merge(antiSpamSchema);

export const venueInquirySchema = z.object({
  venueName: z.string().trim().min(1, "Venue name is required").max(120),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
}).merge(antiSpamSchema);

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  theme: z.string().trim().max(160).optional().or(z.literal("")),
  date: z.string().trim().min(1, "Date is required"),
  venueName: z.string().trim().min(1, "Venue name is required").max(160),
  venueArea: z.string().trim().min(1, "Venue area is required").max(160),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const quizRoundSchema = z.object({
  order: z.coerce.number().int().min(1).max(100),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(500),
});

export const venueSchema = z.object({
  order: z.coerce.number().int().min(1).max(100),
  name: z.string().trim().min(1, "Name is required").max(120),
  area: z.string().trim().max(120).optional().or(z.literal("")),
});
