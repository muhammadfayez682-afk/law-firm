"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { NewTaskModal } from "@/components/modals/NewTaskModal";

export function NewTaskButton({
  users,
  cases,
  intakes,
  services = [],
  currentUserId,
}: {
  users: { id: string; fullName: string; role: UserRole }[];
  cases: { id: string; internalNumber: string; title: string }[];
  intakes: { id: string; requestNumber: string }[];
  services?: { id: string; serviceNumber: string; title: string }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
      >
        + مهمة جديدة
      </button>
      {open && (
        <NewTaskModal
          users={users}
          cases={cases}
          intakes={intakes}
          services={services}
          currentUserId={currentUserId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
