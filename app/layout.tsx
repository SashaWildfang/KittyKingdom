import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PawCursor } from "./paw-cursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kitty Kingdom | Furry Community",
  description: "A furry Discord community for 18+ members.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kitty-theme")||"light";document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <PawCursor />
        {children}
      </body>
    </html>
  );
}
