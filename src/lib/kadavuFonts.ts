import { Archivo_Black, Chilanka, Courier_Prime, DM_Sans } from "next/font/google";

// The Kadavu poster's lettering. Declared here (not in the root layout) so it is only downloaded on the pages
// that use it: the home page banner and that night's registration page.
const title = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-kd-title", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-kd-body", display: "swap" });
const mono = Courier_Prime({ weight: "700", subsets: ["latin"], variable: "--font-kd-mono", display: "swap" });
const hand = Chilanka({ weight: "400", subsets: ["malayalam", "latin"], variable: "--font-kd-hand", display: "swap" });

export const kadavuFonts = `${title.variable} ${body.variable} ${mono.variable} ${hand.variable}`;
