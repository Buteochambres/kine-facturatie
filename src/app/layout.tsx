import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturatie - Kiné van Leeuwen",
  description: "Interne tool voor het versturen van maandelijkse facturen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
