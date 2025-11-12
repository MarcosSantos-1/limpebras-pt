import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plano de Trabalho - Portal Interativo",
  description:
    "Visualize os planos de trabalho dos serviços NH, LE e VP em um mapa interativo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-sA+e2atLYB2gMl30n8y9LgbNf048IIBmQUJyAA8R+yo="
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css"
        />
      </head>
      <body className="min-h-screen bg-slate-100 text-slate-900">
        {children}
      </body>
    </html>
  );
}

