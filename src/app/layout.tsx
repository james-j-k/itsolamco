import type { Metadata, Viewport } from "next";
import { Anton, Archivo, JetBrains_Mono, Noto_Sans_Malayalam } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const archivo = Archivo({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-archivo",
});

const jetbrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// Draws the Malayalam answer on the quiz card. The earlier display font (Baloo
// Chettan 2) didn't form conjuncts like മ്പ and ള്ള, so the word looked wrong;
// Noto Sans Malayalam shapes them correctly. Only fetched when a page uses it.
const malayalam = Noto_Sans_Malayalam({
  weight: "700",
  subsets: ["malayalam"],
  variable: "--font-malayalam",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "It's Olam Company | Kochi's Mollywood Trivia Hub",
  description:
    "Kochi's hyper-local pub quiz outfit — Malayalam pop-culture and Mollywood trivia nights in pubs and restobars across the city.",
};

export const viewport: Viewport = {
  themeColor: "#F5F0E6",
  // Lets the page draw under the iPhone notch/home-indicator area so
  // env(safe-area-inset-*) resolves to real values instead of 0 — needed for
  // the sticky mobile CTA bar to clear the home-indicator gesture zone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${anton.variable} ${archivo.variable} ${jetbrainsMono.variable} ${malayalam.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
