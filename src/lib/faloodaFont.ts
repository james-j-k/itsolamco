import { Phudu } from "next/font/google";

// Falooda Nation's headline font. Declared here (not in the root layout) so it is only
// downloaded on the pages that use it: the home page banner and /falooda.
export const phudu = Phudu({
  subsets: ["latin"],
  variable: "--font-phudu",
  display: "swap",
});
