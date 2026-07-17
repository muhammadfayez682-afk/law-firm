import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NotificationPreferencesView } from "./NotificationPreferencesView";

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return <NotificationPreferencesView />;
}
