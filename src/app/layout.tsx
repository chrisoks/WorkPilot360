import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Google_Sans } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { ModalScrollLock } from "@/components/ui/modal-scroll-lock";

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-google-sans",
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
    icon: [{ url: "/workpilot-mark.svg", type: "image/svg+xml" }],
    shortcut: "/workpilot-mark.svg",
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
      <body className={`${googleSans.className} ${googleSans.variable}`}>
        <ModalScrollLock />
        {children}
      </body>
    </html>
  );
}
