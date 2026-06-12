import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VocoShop - Gestion Commerciale pour Agents",
    template: "%s | VocoShop",
  },
  description: "VocoShop simplifie la gestion de vos boutiques. Suivi des ventes, stocks, commandes et employés. Devenez agent VocoShop.",
  keywords: ["vocoshop", "gestion commerciale", "agent", "boutique", "ventes", "stocks", "commandes", "Congo", "Brazzaville", "Pointe-Noire", "devenir agent"],
  authors: [{ name: "VocoShop" }],
  creator: "VocoShop",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "VocoShop",
    title: "VocoShop - Gestion Commerciale pour Agents",
    description: "Simplifiez la gestion de vos boutiques. Suivi des ventes, stocks, commandes et employés.",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VocoShop - Gestion Commerciale pour Agents",
    description: "Simplifiez la gestion de vos boutiques. Suivi des ventes, stocks, commandes et employés.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
