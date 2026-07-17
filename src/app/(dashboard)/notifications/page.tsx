import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NotificationsView } from "./NotificationsView";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return <NotificationsView />;
}
