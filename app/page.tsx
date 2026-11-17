import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { ManualDashboard } from "@/app/manual/manual-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  return <ManualDashboard userId={userId} />;
}
