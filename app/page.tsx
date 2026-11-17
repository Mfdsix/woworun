import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { ManualView } from "@/app/manual/manual-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  return <ManualView userId={userId} />;
}
