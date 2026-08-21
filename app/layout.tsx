import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Azurra Prospects",
  description: "Prospecção responsável com inteligência operacional.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
