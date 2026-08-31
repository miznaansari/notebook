import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa/PwaRegister";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#3B82F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "NotepadHub - AI Powered Project Notebook & Meeting Manager",
  description: "Personal project notebook, AI-powered meeting notes, client Q&A workspace with 30-day JWT authentication.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/favicon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NotepadHub",
  },
  applicationName: "NotepadHub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-gray-900">
        {children}
        <PwaRegister />
        <Toaster
          position="bottom-right"
          theme="light"
          toastOptions={{
            style: {
              background: "#111827",
              color: "#ffffff",
              border: "none",
              boxShadow: "none",
              borderRadius: "8px",
              fontFamily: "var(--font-outfit)",
            },
          }}
        />
      </body>
    </html>
  );
}
