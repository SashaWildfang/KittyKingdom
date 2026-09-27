import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PageTracker } from "./page-tracker";

export const metadata: Metadata = {
  title: "Kitty Kingdom | Furry Community",
  description: "A furry Discord community for 18+ members.",
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
      </body>
    </html>
  );
}
