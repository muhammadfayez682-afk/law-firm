import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import type { TemplateDefinition, TemplateItem } from "@/lib/templates/definitions";

const BRAND_GREEN = "#16342A";

let cachedFonts: { regular: string; bold: string } | null = null;

function getFontsBase64() {
  if (!cachedFonts) {
    cachedFonts = {
      regular: fs
        .readFileSync(path.join(process.cwd(), "src/lib/fonts/Amiri-Regular.ttf"))
        .toString("base64"),
      bold: fs
        .readFileSync(path.join(process.cwd(), "src/lib/fonts/Amiri-Bold.ttf"))
        .toString("base64"),
    };
  }
  return cachedFonts;
}

function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function multiline(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

type FilledData = Record<string, unknown>;

function fieldRow(key: string, label: string, value: string, half: boolean): string {
  if (half) {
    return `<td class="label-cell half">${escapeHtml(label)}</td><td class="value-cell half">${multiline(value)}</td>`;
  }
  return `<td class="label-cell">${escapeHtml(label)}</td><td class="value-cell" colspan="3">${multiline(value)}</td>`;
}

function renderItems(items: TemplateItem[], data: FilledData): string {
  let html = "";
  let pendingHalf: { label: string; value: string } | null = null;

  for (const item of items) {
    if (item.kind === "field") {
      const rawValue = data[item.key];
      const value = typeof rawValue === "string" ? rawValue : "";

      if (item.half) {
        if (pendingHalf) {
          html += `<tr>${fieldRow(item.key, pendingHalf.label, pendingHalf.value, true)}${fieldRow(item.key, item.label, value, true)}</tr>`;
          pendingHalf = null;
        } else {
          pendingHalf = { label: item.label, value };
        }
        continue;
      }

      if (pendingHalf) {
        html += `<tr>${fieldRow("", pendingHalf.label, pendingHalf.value, true)}<td class="value-cell half"></td><td class="label-cell half"></td></tr>`;
        pendingHalf = null;
      }

      html += `<tr>${fieldRow(item.key, item.label, value, false)}</tr>`;
    } else {
      if (pendingHalf) {
        html += `<tr>${fieldRow("", pendingHalf.label, pendingHalf.value, true)}<td class="value-cell half"></td><td class="label-cell half"></td></tr>`;
        pendingHalf = null;
      }

      const matrixData = (data[item.key] as Record<string, Record<string, string>>) ?? {};

      html += `<tr><td colspan="4" class="section-title">${escapeHtml(item.title)}</td></tr>`;
      html += `<tr><td class="col-header row-index-header">${item.rows.every((r) => r.label) ? "" : "م"}</td>`;
      for (const col of item.columns) {
        html += `<td class="col-header">${escapeHtml(col.label)}</td>`;
      }
      html += `</tr>`;

      item.rows.forEach((row, index) => {
        const rowValues = matrixData[row.key] ?? {};
        html += `<tr>`;
        html += `<td class="label-cell matrix-row-label">${row.label ? escapeHtml(row.label) : index + 1}</td>`;
        for (const col of item.columns) {
          const v = rowValues[col.key];
          html += `<td class="value-cell matrix-cell">${multiline(typeof v === "string" ? v : "")}</td>`;
        }
        html += `</tr>`;
      });
    }
  }

  if (pendingHalf) {
    html += `<tr>${fieldRow("", pendingHalf.label, pendingHalf.value, true)}<td class="value-cell half"></td><td class="label-cell half"></td></tr>`;
  }

  return html;
}

function buildHtml(definition: TemplateDefinition, data: FilledData): string {
  const fonts = getFontsBase64();
  const rowsHtml = renderItems(definition.items, data);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Amiri';
    src: url(data:font/ttf;base64,${fonts.regular}) format('truetype');
    font-weight: normal;
  }
  @font-face {
    font-family: 'Amiri';
    src: url(data:font/ttf;base64,${fonts.bold}) format('truetype');
    font-weight: bold;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Amiri', serif;
    direction: rtl;
    margin: 0;
    padding: 34px 38px;
    color: #111;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid ${BRAND_GREEN};
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .firm-name {
    font-size: 13px;
    font-weight: bold;
    color: ${BRAND_GREEN};
  }
  .dept-name {
    font-size: 11px;
    color: ${BRAND_GREEN};
    margin-top: 2px;
  }
  .logo-mark {
    width: 40px;
    height: 40px;
    border: 2px solid ${BRAND_GREEN};
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${BRAND_GREEN};
    font-weight: bold;
    font-size: 16px;
    transform: rotate(45deg);
  }
  .logo-mark span { transform: rotate(-45deg); }
  .form-title {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    color: ${BRAND_GREEN};
    margin: 0 0 16px;
  }
  table.form-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  table.form-table td {
    border: 1px solid ${BRAND_GREEN};
    padding: 6px 8px;
    vertical-align: middle;
  }
  .label-cell {
    background: ${BRAND_GREEN};
    color: #fff;
    font-weight: bold;
    width: 22%;
    text-align: center;
  }
  .label-cell.half { width: 14%; }
  .value-cell { background: #fff; width: auto; min-height: 20px; }
  .value-cell.half { width: 14%; }
  .section-title {
    background: ${BRAND_GREEN};
    color: #fff;
    font-weight: bold;
    text-align: center;
    padding: 7px;
  }
  .col-header {
    background: ${BRAND_GREEN};
    color: #fff;
    font-weight: bold;
    text-align: center;
  }
  .row-index-header { width: 6%; }
  .matrix-row-label {
    width: 20%;
    font-size: 9.5px;
  }
  .matrix-cell { min-height: 28px; }
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

  <h1 class="form-title">${escapeHtml(definition.name)}</h1>

  <table class="form-table">
    ${rowsHtml}
  </table>
</body>
</html>`;
}

export async function generateTemplatePdf(
  definition: TemplateDefinition,
  data: FilledData
): Promise<Buffer> {
  const html = buildHtml(definition, data);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBytes = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm" } });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
