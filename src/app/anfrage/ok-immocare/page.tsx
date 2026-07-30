import type { Metadata, Viewport } from "next";
import { PublicRequestForm } from "@/components/online-requests/public-request-form";

export const metadata: Metadata = {
  title: "Online-Anfrage | OK immocare",
  description:
    "Leistungen, Rückrufe, Durchführungen oder Mängel schnell und sicher bei OK immocare anfragen.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#242a2d",
};

export default function OkImmocareRequestPage() {
  return <PublicRequestForm />;
}
