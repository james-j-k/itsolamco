import type { Metadata, Viewport } from "next";
import { Anton, Archivo, JetBrains_Mono, Baloo_Chettan_2 } from "next/font/google";
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

const balooChettan2 = Baloo_Chettan_2({
  weight: "600",
  subsets: ["latin"],
  variable: "--font-baloo-chettan-2",
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
      className={`scroll-smooth ${anton.variable} ${archivo.variable} ${jetbrainsMono.variable} ${balooChettan2.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
