import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "WiseAI — AI Video Intelligence",
  description: "RAG-powered video analytics chatbot for creators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
