import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VocoShop - Dashboard Agent",
  description: "Plateforme de gestion des boutiques pour agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
