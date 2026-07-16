import { redirect } from "next/navigation";
export default function LegacyReviewPage() { redirect("/history?view=drafts"); }
