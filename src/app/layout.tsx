import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Splash } from "@/components/brand/splash";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Relay",
  description: "Client Slack requests, tracked and never forgotten.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions and IDE inspectors add attributes to <html> before React loads. Ignore only that mismatch.
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Splash />
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
