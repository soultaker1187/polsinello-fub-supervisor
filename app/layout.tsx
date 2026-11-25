import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Database Supervisor | The Polsinello Team", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
