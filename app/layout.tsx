import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DonationProvider } from "@/contexts/DonationContext";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PreviewBanner from "@/components/projects/PreviewBanner";
import { isProjectPreviewRequest } from "@/lib/project-preview";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const isPreview = await isProjectPreviewRequest()
  return {
    title: "Litecoin Fund",
    description: "Open Source Projects, Bounties, and Initiatives for the Litecoin Ecosystem",
    // Served under /static/ so the litecoin.com Cloudflare worker (which only forwards
    // /donate, /projects, /_next, /api, /static) routes them to this origin.
    icons: {
      icon: [
        { url: "/static/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/static/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/static/favicons/favicon-litecoin.png", type: "image/png" },
      ],
      apple: [
        { url: "/static/favicons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/static/favicons/site.webmanifest",
    robots: isPreview ? { index: false, follow: false } : undefined,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isPreview = await isProjectPreviewRequest()
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DonationProvider>
          <div className="flex min-h-screen flex-col">
            {isPreview && <PreviewBanner />}
            <Navigation />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </DonationProvider>
      </body>
    </html>
  );
}
