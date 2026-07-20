import { redirect } from "next/navigation";

// صفحة الأرشيف = عرض القضايا بتبويب «مؤرشفة».
export default function ArchivedCasesPage() {
  redirect("/cases?view=archived");
}
