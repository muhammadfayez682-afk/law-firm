import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  checkAgencyDuplicate,
  checkIdentityDuplicate,
  checkPhoneDuplicate,
} from "@/lib/duplicateCheck";

/**
 * فحص تكرار حيّ (للبانر الإعلامي أثناء الكتابة).
 * GET /api/duplicate-check?type=phone|national_id|agency_number&value=...&excludeClientId=...
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const value = searchParams.get("value")?.trim() ?? "";
  const excludeClientId = searchParams.get("excludeClientId") ?? undefined;
  const excludeIntakeId = searchParams.get("excludeIntakeId") ?? undefined;
  const excludePartyId = searchParams.get("excludePartyId") ?? undefined;

  if (!value) {
    return NextResponse.json({ hasDuplicate: false, existingIn: [] });
  }

  const opts = { excludeClientId, excludeIntakeId, excludePartyId };

  if (type === "phone") return NextResponse.json(await checkPhoneDuplicate(value, opts));
  if (type === "national_id") return NextResponse.json(await checkIdentityDuplicate(value, opts));
  if (type === "agency_number") return NextResponse.json(await checkAgencyDuplicate(value, excludeClientId));

  return NextResponse.json({ error: "نوع فحص غير صالح" }, { status: 400 });
}
