import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "Azurra Viral", description: "Radar de conteúdo, tendências e inteligência criativa." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
