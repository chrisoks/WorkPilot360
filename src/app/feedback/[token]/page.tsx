import { FeedbackForm } from "./feedback-form";
import "./style.css";

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FeedbackForm token={token} />;
}
