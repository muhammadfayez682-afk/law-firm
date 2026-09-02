// تخزين المستندات على Cloudflare R2 (متوافق مع S3). المستندات خاصة —
// كل وصول عبر رابط موقّت (presigned) قصير الأجل، لا روابط عامة.
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** هل مفاتيح R2 مهيّأة في البيئة؟ (يُستخدم للسقوط الاحتياطي/رسائل الخطأ الواضحة). */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT
  );
}

const BUCKET = () => process.env.R2_BUCKET ?? "qudum-documents";

// عميل S3 كسول — لا يُنشأ عند الاستيراد كي لا يفشل البناء/الاستيراد دون مفاتيح.
let _client: S3Client | null = null;
function client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 غير مهيأ: تأكد من متغيرات R2_* في البيئة.");
  }
  if (!_client) {
    _client = new S3Client({
      region: "auto", // R2 يتجاهل المنطقة لكن SDK يتطلبها
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

/** يُطهّر اسم الملف (يبقي حروف/أرقام/عربي/نقطة/شرطة) لتفادي مفاتيح غير صالحة. */
function safeFileName(fileName: string): string {
  return fileName.replace(/[^\w.؀-ۿ-]/g, "_").slice(0, 120) || "file";
}

/**
 * بنية مفاتيح منظّمة لتجنّب التصادم وتسهيل التنظيم:
 * <scope>/<ownerId>/<uuid>-<filename>  — مثال: cases/<caseId>/<uuid>-عقد.pdf
 */
export function buildDocumentKey(scope: "cases" | "intake" | "services" | "general", ownerId: string, fileName: string): string {
  return `${scope}/${ownerId}/${randomUUID()}-${safeFileName(fileName)}`;
}

/** يرفع مخزنًا (Buffer/Uint8Array) لـ R2 ويعيد المفتاح (key). */
export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return key;
}

/**
 * رابط تنزيل موقّت (presigned GET) قصير الأجل للقراءة الآمنة.
 * صلاحية افتراضية 10 دقائق. يمكن تمرير اسم عرض ليُفتح باسم واضح في المتصفح.
 */
export async function getSignedDownloadUrl(
  key: string,
  opts: { expiresInSeconds?: number; downloadName?: string } = {}
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ...(opts.downloadName
      ? { ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}` }
      : {}),
  });
  return getSignedUrl(client(), command, { expiresIn: opts.expiresInSeconds ?? 600 });
}

/** حذف مستند من R2. */
export async function deleteFromR2(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
