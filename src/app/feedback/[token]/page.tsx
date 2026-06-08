import { FeedbackForm } from "./feedback-form";
import "./style.css";

export default function FeedbackPage({ params }: { params: { token: string } }) {
  return <FeedbackForm token={params.token} />;
}
