import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./polish.css";
import "./glass.css";
import "./page-layouts.css";
import "./light-mode.css";
import "./device-prefs.css";
import { Inter } from "next/font/google";
import { PageTracker } from "./page-tracker";
import { TimeZoneSync } from "./time-zone-sync";
import { ViewAsBar } from "./view-as-bar";
import { SiteFooter } from "./site-footer";
import { SeasonProvider } from "./season-context";
import { SeasonBackdrop } from "./season-backdrop";
import { getAllSeasonViews, getSeason } from "../lib/season-store";

// The site font (self-hosted by Next at build time)
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const SITE = "https://bear-nation.net";
const DESCRIPTION =
  "Bear Nation is a cozy, seasonal 18+ furry Discord server and community website: make friends, meet people through Social profiles, earn the server currency, level up and join events.";
// "Bear Nation" alone is shared with cat cafés and games, so the title says what we are
const TITLE = "Bear Nation | 18+ Furry Discord Server & Community";

// Search engines and link previews (Discord, X, iMessage…) read these
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Bear Nation",
  keywords: ["Bear Nation", "Bear Nation Discord", "Bear Nation furry", "bear-nation.net", "furry discord", "furry discord server", "furry community", "18+ furry server", "furry friends", "fursona", "LGBTQ furry", "furry social"],
  // Search Console / Bing Webmaster ownership checks (set the codes in Vercel's environment variables)
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Bear Nation",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/banner.jpg", alt: "Bear Nation: a cozy furry community" }],
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/banner.jpg"] },
  robots: { index: true, follow: true },
};

// Pages built ahead of time are refreshed every minute, so a season change reaches them too
export const revalidate = 60;

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [season, all] = await Promise.all([getSeason(), getAllSeasonViews()]);
  return (
    // data-theme is set only by the script below (from the saved preference) and the theme
    // switch, never by React, so re-renders can't flip someone back to light mode
    // data-season picks the season's colors and scenery (an admin's preview can swap it before paint)
    <html lang="en" data-season={season.key} className={sans.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Saved "light"/"dark", or follow the device (the default, "System"); then this browser's
            // text size, motion and seasonal-effects choices (Settings → Appearance, app/device-prefs.ts)
            __html: `(function(){var t;try{t=localStorage.getItem("kitty-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;var s;try{s=localStorage.getItem("kk-season-preview")}catch(e){}if(s==="spring"||s==="summer"||s==="fall"||s==="winter"){document.documentElement.dataset.season=s}var d=document.documentElement.dataset;try{var x=localStorage.getItem("kk-text");if(x==="small"||x==="large"||x==="xl")d.text=x;x=localStorage.getItem("kk-motion");if(x==="reduce"||x==="full")d.motion=x;if(localStorage.getItem("kk-fx")==="off")d.fx="off"}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <SeasonProvider live={season} all={all}>
          <SeasonBackdrop />
          {children}
          {/* The same footer on every page */}
          <SiteFooter />
          <PageTracker />
          <TimeZoneSync />
          <ViewAsBar />
        </SeasonProvider>
      </body>
    </html>
  );
}
