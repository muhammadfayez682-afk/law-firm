import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { GlossaryView } from "./GlossaryView";

export default async function GlossaryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return <GlossaryView />;
}
