import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { ManualDashboard } from "./manual-dashboard";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/unlock");

  return <ManualDashboard userId={userId} />;
}
