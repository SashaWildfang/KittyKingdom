import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PageTracker } from "./page-tracker";
import { TimeZoneSync } from "./time-zone-sync";
import { ViewAsBar } from "./view-as-bar";
import { SiteFooter } from "./site-footer";

const SITE = "https://www.kittykingdom.net";
const DESCRIPTION =
  "Kitty Kingdom is a cozy, fall-themed 18+ furry Discord community: make friends, meet people through Social profiles, earn Leaves, level up and join events.";

// Search engines and link previews (Discord, X, iMessage…) read these
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Kitty Kingdom | 18+ Furry Community & Social Discord",
  description: DESCRIPTION,
  applicationName: "Kitty Kingdom",
  keywords: ["furry discord", "furry community", "18+ furry server", "furry friends", "fursona", "LGBTQ furry", "furry social", "Kitty Kingdom"],
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Kitty Kingdom",
    title: "Kitty Kingdom | 18+ Furry Community & Social",
    description: DESCRIPTION,
    images: [{ url: "/banner.jpg", alt: "Kitty Kingdom: a cozy fall-themed furry community" }],
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Kitty Kingdom | 18+ Furry Community & Social", description: DESCRIPTION, images: ["/banner.jpg"] },
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
            // Saved "light"/"dark", or follow the device (the default, "System")
            __html: `(function(){var t;try{t=localStorage.getItem("kitty-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`,
          }}
        />
      </head>
      <body>
        {children}
        {/* The same footer on every page */}
        <SiteFooter />
        <PageTracker />
        <TimeZoneSync />
        <ViewAsBar />
      </body>
    </html>
  );
}
