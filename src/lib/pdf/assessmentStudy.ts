import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const BRAND_GREEN = "#16342A";

let cachedFonts: { regular: string; bold: string } | null = null;
function getFontsBase64() {
  if (!cachedFonts) {
    cachedFonts = {
      regular: fs.readFileSync(path.join(process.cwd(), "src/lib/fonts/Amiri-Regular.ttf")).toString("base64"),
      bold: fs.readFileSync(path.join(process.cwd(), "src/lib/fonts/Amiri-Bold.ttf")).toString("base64"),
    };
  }
  return cachedFonts;
}

function esc(t: unknown): string {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function ml(t: unknown): string {
  return esc(t).replace(/\n/g, "<br/>");
}

export type AssessmentStudyData = {
  requestNumber: string;
  clientName: string;
  clientIdNumber: string | null;
  clientPhone: string;
  caseTypeLabel: string;
  opposingParty: string | null;
  facts: string | null;
  evidence: string | null;
  documents: { title: string }[];
  legalBasis: string | null;
  jurisdiction: string | null;
  strengths: string | null;
  weaknesses: string | null;
  estimatedDuration: string | null;
  proposedFee: string | null;
  finalDirection: string | null;
  approverNotes: string | null;
  approvedByName: string | null;
  approvedAtLabel: string | null;
};

const DASH = "—";

function infoRow(label: string, value: string | null): string {
  return `<tr><td class="label-cell">${esc(label)}</td><td class="value-cell">${esc(value || DASH)}</td></tr>`;
}

function section(title: string, value: string | null): string {
  return `<div class="block">
    <div class="block-title">${esc(title)}</div>
    <div class="block-body">${value && value.trim() ? ml(value) : `<span class="muted">${DASH}</span>`}</div>
  </div>`;
}

function buildHtml(d: AssessmentStudyData): string {
  const fonts = getFontsBase64();
  const docsHtml = d.documents.length
    ? `<ul class="docs">${d.documents.map((x) => `<li>${esc(x.title)}</li>`).join("")}</ul>`
    : `<span class="muted">لا مستندات مرفقة</span>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family:'Amiri'; src:url(data:font/ttf;base64,${fonts.regular}) format('truetype'); font-weight:normal; }
  @font-face { font-family:'Amiri'; src:url(data:font/ttf;base64,${fonts.bold}) format('truetype'); font-weight:bold; }
  * { box-sizing:border-box; }
  body { font-family:'Amiri',serif; direction:rtl; margin:0; padding:32px 38px; color:#141414; font-size:12px; line-height:1.6; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid ${BRAND_GREEN}; padding-bottom:10px; margin-bottom:6px; }
  .firm-name { font-size:14px; font-weight:bold; color:${BRAND_GREEN}; }
  .dept-name { font-size:11px; color:${BRAND_GREEN}; margin-top:2px; }
  .logo-mark { width:42px; height:42px; border:2px solid ${BRAND_GREEN}; border-radius:6px; display:flex; align-items:center; justify-content:center; color:${BRAND_GREEN}; font-weight:bold; font-size:17px; transform:rotate(45deg); }
  .logo-mark span { transform:rotate(-45deg); }
  .form-title { text-align:center; font-size:17px; font-weight:bold; color:${BRAND_GREEN}; margin:14px 0 2px; }
  .req-no { text-align:center; font-size:11px; color:#555; margin-bottom:16px; }
  table.info { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11px; }
  table.info td { border:1px solid ${BRAND_GREEN}; padding:6px 8px; }
  .label-cell { background:${BRAND_GREEN}; color:#fff; font-weight:bold; width:24%; }
  .value-cell { background:#fff; }
  .block { border:1px solid ${BRAND_GREEN}; border-radius:4px; margin-bottom:12px; overflow:hidden; }
  .block-title { background:${BRAND_GREEN}; color:#fff; font-weight:bold; padding:6px 10px; font-size:12px; }
  .block-body { padding:9px 11px; white-space:normal; min-height:22px; }
  .two { display:flex; gap:12px; }
  .two > .block { flex:1; }
  .muted { color:#999; }
  .docs { margin:4px 0 0; padding-inline-start:18px; }
  .docs li { margin-bottom:3px; }
  .footer { margin-top:22px; border-top:2px solid ${BRAND_GREEN}; padding-top:10px; display:flex; justify-content:space-between; font-size:11px; color:#333; }
  .footer .approved { font-weight:bold; color:${BRAND_GREEN}; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="firm-name">شركة قدوم الحقائق للمحاماة والاستشارات القانونية</div>
      <div class="dept-name">إدارة الدراسات والتقاضي</div>
    </div>
    <div class="logo-mark"><span>ق</span></div>
  </div>

  <h1 class="form-title">دراسة تقييم وتحديد مسار</h1>
  <div class="req-no">رقم الطلب: ${esc(d.requestNumber)}</div>

  <table class="info">
    ${infoRow("الموكّل", d.clientName)}
    ${infoRow("الهوية / السجل", d.clientIdNumber)}
    ${infoRow("الجوال", d.clientPhone)}
    ${infoRow("التصنيف المقترح", d.caseTypeLabel)}
    ${infoRow("الطرف المقابل", d.opposingParty)}
  </table>

  ${section("الوقائع", d.facts)}

  <div class="block">
    <div class="block-title">البينات والأسانيد</div>
    <div class="block-body">
      ${d.evidence && d.evidence.trim() ? ml(d.evidence) : `<span class="muted">${DASH}</span>`}
      <div style="margin-top:6px; font-weight:bold; color:${BRAND_GREEN};">المستندات المرفقة:</div>
      ${docsHtml}
    </div>
  </div>

  ${section("التكييف القانوني", d.legalBasis)}
  ${section("الاختصاص القضائي", d.jurisdiction)}
  <div class="two">
    ${section("نقاط القوة", d.strengths)}
    ${section("نقاط الضعف", d.weaknesses)}
  </div>
  <div class="two">
    ${section("المدة التقريبية", d.estimatedDuration)}
    ${section("الأتعاب المقترحة", d.proposedFee)}
  </div>
  ${section("التوجّه النهائي", d.finalDirection)}
  ${section("ملاحظات واقتراحات المسؤول", d.approverNotes)}

  <div class="footer">
    <span class="approved">اعتماد المسؤول: ${esc(d.approvedByName || DASH)}</span>
    <span>تاريخ الاعتماد: ${esc(d.approvedAtLabel || DASH)}</span>
  </div>
</body>
</html>`;
}

export async function generateAssessmentPdf(data: AssessmentStudyData): Promise<Buffer> {
  const html = buildHtml(data);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdfBytes = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm" } });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
