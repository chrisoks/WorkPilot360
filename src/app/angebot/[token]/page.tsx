import OfferAcceptanceForm from "./offer-acceptance-form";
import "./style.css";

export default async function OfferAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OfferAcceptanceForm token={token} />;
}
