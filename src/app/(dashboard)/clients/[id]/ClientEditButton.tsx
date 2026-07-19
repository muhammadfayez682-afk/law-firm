"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { EditEntityModal, type EditableFieldDescriptor } from "@/components/shared/EditEntityModal";
import { canEditField } from "@/lib/editPermissions";

type ClientData = {
  id: string;
  type: "individual" | "company";
  fullName: string;
  nationalIdOrCr: string | null;
  phone: string | null;
  email: string | null;
  representativeName: string | null;
};

function lockState(check: { allowed: boolean; reason?: string }) {
  return check.allowed ? { locked: false } : { locked: true, lockReason: check.reason };
}

export function ClientEditButton({ client, userRole }: { client: ClientData; userRole: UserRole }) {
  const [open, setOpen] = useState(false);
  const lock = (f: string) => canEditField("client", f, userRole, {});

  const fields: EditableFieldDescriptor[] = [
    { name: "fullName", label: client.type === "individual" ? "الاسم الكامل" : "اسم الشركة", type: "text", value: client.fullName, ...lockState(lock("fullName")) },
    {
      name: "nationalIdOrCr",
      label: client.type === "individual" ? "رقم الهوية/السجل" : "رقم السجل التجاري",
      type: "text",
      value: client.nationalIdOrCr ?? "",
      ...lockState(lock("nationalIdOrCr")),
    },
    { name: "phone", label: "الجوال", type: "text", value: client.phone ?? "", ...lockState(lock("phone")) },
    { name: "email", label: "البريد الإلكتروني", type: "text", value: client.email ?? "", ...lockState(lock("email")) },
    ...(client.type === "company"
      ? [{ name: "representativeName", label: "اسم الممثل", type: "text" as const, value: client.representativeName ?? "", ...lockState(lock("representativeName")) }]
      : []),
  ];

  // لا نعرض الزر إن كانت كل الحقول مقفلة على هذا الدور.
  if (fields.every((f) => f.locked)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
      >
        تعديل البيانات
      </button>
      {open && (
        <EditEntityModal
          entityType="client"
          entityId={client.id}
          apiPath={`/api/clients/${client.id}`}
          title="تعديل بيانات العميل"
          fields={fields}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
