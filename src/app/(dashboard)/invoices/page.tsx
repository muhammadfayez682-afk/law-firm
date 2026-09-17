import { redirect } from "next/navigation";

// دُمجت الفواتير والمصاريف في «المركز المالي» الموحّد — نوجّه الروابط القديمة إليه.
export default function InvoicesPage() {
  redirect("/finance");
}
