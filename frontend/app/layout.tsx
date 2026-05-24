import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Janus — Financial Intelligence System",
  description: "Autonomous multi-agent financial intelligence system with behavioral learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${cinzel.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--janus-background)]">
        {children}
      </body>
    </html>
  );
}
