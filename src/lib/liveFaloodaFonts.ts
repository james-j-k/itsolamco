import { Montserrat, Shrikhand } from "next/font/google";
import { phudu } from "@/lib/faloodaFont";

// The fonts of the Falooda Nation night's slides. Declared here so they are only downloaded
// on the live quiz pages that use that theme.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400", variable: "--font-shrikhand", display: "swap" });

export const faloodaLiveFonts = [phudu.variable, montserrat.variable, shrikhand.variable].join(" ");
