import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arboleda — Actividades",
  description: "Actividades, retiros y círculos de estudio en Arboleda",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
