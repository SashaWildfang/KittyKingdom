import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PageTracker } from "./page-tracker";
import { TimeZoneSync } from "./time-zone-sync";
import { ViewAsBar } from "./view-as-bar";

const SITE = "https://www.kittykingdom.net";
const DESCRIPTION =
  "Kitty Kingdom is a cozy, fall-themed 18+ furry Discord community: make friends, find a partner with our furry dating profiles and matchmaking, earn Leaves, level up and join events.";

// Search engines and link previews (Discord, X, iMessage…) read these
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Kitty Kingdom | 18+ Furry Community & Dating Discord",
  description: DESCRIPTION,
  applicationName: "Kitty Kingdom",
  keywords: ["furry discord", "furry dating", "furry community", "18+ furry server", "furry friends", "fursona", "LGBTQ furry", "furry matchmaking", "Kitty Kingdom"],
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Kitty Kingdom",
    title: "Kitty Kingdom | 18+ Furry Community & Dating",
    description: DESCRIPTION,
    images: [{ url: "/banner.jpg", alt: "Kitty Kingdom: a cozy fall-themed furry community" }],
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Kitty Kingdom | 18+ Furry Community & Dating", description: DESCRIPTION, images: ["/banner.jpg"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    // data-theme is set only by the script below (from the saved preference) and the theme
    // switch, never by React, so re-renders can't flip someone back to light mode
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kitty-theme")||"light";document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <PageTracker />
        <TimeZoneSync />
        <ViewAsBar />
      </body>
    </html>
  );
}
