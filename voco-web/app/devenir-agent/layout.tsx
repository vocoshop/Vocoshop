import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Devenir Agent VocoShop - Rejoignez notre réseau",
  description: "Rejoignez VocoShop en tant qu'agent commercial. Gérez des boutiques, gagnez des commissions et développez votre activité au Congo et en Afrique.",
  keywords: ["devenir agent", "agent commercial", "vocoshop", "emploi Congo", "Brazzaville", "Pointe-Noire", "commission", "boutique"],
  openGraph: {
    title: "Devenir Agent VocoShop",
    description: "Rejoignez notre réseau d'agents commerciaux. Gagnez des commissions en gérant des boutiques.",
  },
};

export default function DevenirAgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
