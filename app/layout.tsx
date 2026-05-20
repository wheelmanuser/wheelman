import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo_Narrow, Hanken_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const archivNarrow = Archivo_Narrow({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600", "700"],
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Wheelman",
  description: "Vehicle history and maintenance logbook",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${archivNarrow.variable} ${hankenGrotesk.variable} ${geistMono.variable} min-h-screen bg-wm-bg text-wm-text antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
