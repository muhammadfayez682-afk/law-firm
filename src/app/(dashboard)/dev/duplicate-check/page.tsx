import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import { normalizeSaudiPhone } from "@/lib/validators";
import { toEnglishDigits } from "@/lib/formatNumber";

type Record = { label: string; href?: string };
type Group = { value: string; records: Record[] };

function groupDuplicates(entries: { key: string | null; record: Record }[]): Group[] {
  const map = new Map<string, Record[]>();
  for (const { key, record } of entries) {
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(record);
  }
  return [...map.entries()]
    .filter(([, recs]) => recs.length > 1)
    .map(([value, records]) => ({ value, records }));
}

export default async function DuplicateCheckDevPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSystemAdmin(session.user.role)) notFound();

  const [clients, intakes, parties, agencies] = await Promise.all([
    prisma.client.findMany({ select: { id: true, fullName: true, phone: true, nationalIdOrCr: true } }),
    prisma.intakeRequest.findMany({
      where: { caseId: null, status: { notIn: ["rejected", "cancelled", "accepted"] } },
      select: { id: true, clientName: true, clientPhone: true, clientIdNumber: true, requestNumber: true },
    }),
    prisma.caseParty.findMany({ select: { id: true, name: true, phone: true, identityNumber: true, linkedClientId: true } }),
    prisma.agency.findMany({ select: { id: true, agencyNumber: true, clientId: true, client: { select: { fullName: true } } } }),
  ]);

  const phoneEntries: { key: string | null; record: Record }[] = [
    ...clients.map((c) => ({ key: c.phone ? normalizeSaudiPhone(c.phone) : null, record: { label: `عميل: ${c.fullName}`, href: `/clients/${c.id}` } })),
    ...intakes.map((i) => ({ key: i.clientPhone ? normalizeSaudiPhone(i.clientPhone) : null, record: { label: `طلب ${i.requestNumber}: ${i.clientName}`, href: `/intake/${i.id}` } })),
    ...parties.map((p) => ({ key: p.phone ? normalizeSaudiPhone(p.phone) : null, record: { label: `طرف: ${p.name}`, href: p.linkedClientId ? `/clients/${p.linkedClientId}` : undefined } })),
  ];

  const idEntries: { key: string | null; record: Record }[] = [
    ...clients.map((c) => ({ key: c.nationalIdOrCr, record: { label: `عميل: ${c.fullName}`, href: `/clients/${c.id}` } })),
    ...intakes.map((i) => ({ key: i.clientIdNumber, record: { label: `طلب ${i.requestNumber}: ${i.clientName}`, href: `/intake/${i.id}` } })),
    ...parties.map((p) => ({ key: p.identityNumber, record: { label: `طرف: ${p.name}`, href: p.linkedClientId ? `/clients/${p.linkedClientId}` : undefined } })),
  ];

  const agencyEntries: { key: string | null; record: Record }[] = agencies.map((a) => ({
    key: a.agencyNumber,
    record: { label: `وكالة: ${a.client.fullName}`, href: `/clients/${a.clientId}` },
  }));

  const sections = [
    { title: "أرقام جوال مكررة", type: "جوال", groups: groupDuplicates(phoneEntries) },
    { title: "أرقام هوية/سجل مكررة", type: "هوية", groups: groupDuplicates(idEntries) },
    { title: "أرقام وكالة مكررة", type: "وكالة", groups: groupDuplicates(agencyEntries) },
  ];

  const totalDups = sections.reduce((s, sec) => s + sec.groups.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-foreground/50">أداة تطوير — مسؤول النظام فقط</p>
        <h1 className="font-amiri text-2xl font-bold text-navy">فحص التكرارات الموجودة</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {totalDups === 0 ? "لا توجد تكرارات." : `${toEnglishDigits(totalDups)} مجموعة تكرار.`}{" "}
          الطلبات المُفعَّلة/المرفوضة مستثناة (نفس الشخص/غير نشطة).
        </p>
      </div>

      {sections.map((sec) => (
        <section key={sec.title} className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-navy">{sec.title}</h2>
            <span className="rounded-full bg-navy/5 px-2.5 py-1 text-xs text-foreground/60">
              {toEnglishDigits(sec.groups.length)}
            </span>
          </div>
          {sec.groups.length === 0 ? (
            <p className="text-sm text-foreground/50">لا يوجد</p>
          ) : (
            <ul className="space-y-3">
              {sec.groups.map((g) => (
                <li key={g.value} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-2 font-mono text-sm font-semibold text-amber-900" dir="ltr">
                    {toEnglishDigits(g.value)} <span className="text-xs text-amber-700">({toEnglishDigits(g.records.length)} سجل)</span>
                  </p>
                  <ul className="space-y-1 text-sm">
                    {g.records.map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-foreground/80">{r.label}</span>
                        {r.href && (
                          <Link href={r.href} className="shrink-0 text-xs text-taradhi hover:underline">
                            عرض ←
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="rounded-lg border border-black/5 bg-black/[0.02] px-4 py-3 text-xs text-foreground/50">
        الدمج اليدوي: افتح السجلات وحدّث/احذف المكرر منها. التفرّد على هوية العميل مضمون في قاعدة البيانات؛
        الجوال يسمح بالتكرار عمدًا بعد تأكيد المستخدم.
      </p>
    </div>
  );
}
