import { redirect } from "next/navigation";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

export default async function ActivityPage() {
  const user = await requireUser();
  if (!can(user.role, "activity.view")) redirect("/tasks");
  return <ActivityFeed />;
}
