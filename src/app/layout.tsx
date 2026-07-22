import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Outfit } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { ModalScrollLock } from "@/components/ui/modal-scroll-lock";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: {
    default: "WorkPilot360",
    template: "%s | WorkPilot360",
  },
  description: "WorkPilot360 Hauptprogramm",
  applicationName: "WorkPilot360",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WorkPilot360",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/workpilot360-app-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${outfit.className} ${outfit.variable}`}>
        <ModalScrollLock />
        {children}
      </body>
    </html>
  );
}
