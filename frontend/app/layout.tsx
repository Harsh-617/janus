import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";

export const metadata: Metadata = {
  title: "Janus",
  description: "Autonomous Financial Intelligence System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full font-sans" style={{ background: "#080A0C" }}>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
