import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  const userId = await getSessionUserId();
  if (userId) redirect("/");

  return <UnlockForm />;
}
