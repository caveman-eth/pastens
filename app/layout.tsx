import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pastens — ENS Ownership History",
  description: "Explore the ownership history of Ethereum Name Service (ENS) domains",
  openGraph: {
    title: "pastens — ENS Ownership History",
    description: "Explore the ownership history of Ethereum Name Service (ENS) domains",
    images: [
      {
        url: "/seo.png",
        width: 1200,
        height: 630,
        alt: "pastens — ENS Ownership History",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "pastens — ENS Ownership History",
    description: "Explore the ownership history of Ethereum Name Service (ENS) domains",
    images: ["/seo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
