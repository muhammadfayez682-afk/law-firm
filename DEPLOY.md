# نشر «ميزان» على Railway

هذا الدليل يشرح نشر النظام على [Railway](https://railway.com). ملفات الإعداد (`Dockerfile`،
`railway.json`، `.dockerignore`) جاهزة في المستودع — الخطوات أدناه تخصّ حسابك وأسرارك (لا يمكن
أتمتتها لأنها تتطلب تسجيل دخولك وإدخال قيم سرّية).

## ما يفعله الإعداد الجاهز

- **`Dockerfile`**: صورة `node:22-bookworm-slim` + مكتبات نظام Chromium (ليعمل Puppeteer/توليد PDF)
  → `npm ci` → `prisma generate` → `next build`.
- **الإقلاع**: `prisma migrate deploy` (يطبّق الهجرات) ثم `next start`.
- **فحص الصحة**: `GET /api/auth/csrf`.

## المتطلبات المسبقة (عليك أنت)

1. حساب على Railway (سجّل الدخول عبر GitHub).
2. تثبيت Railway CLI (اختياري، للطريقة الثانية): `npm i -g @railway/cli`.

## الخطوات

### 1) أنشئ المشروع + قاعدة البيانات
- من لوحة Railway: **New Project**.
- داخل المشروع: **+ New → Database → PostgreSQL**. سيوفّر Railway متغيّر `DATABASE_URL`.

### 2) أضِف خدمة التطبيق
اختر إحدى الطريقتين:

**أ) عبر GitHub (موصى بها):**
1. ارفع المستودع إلى GitHub (يحتاج مستودعك وصلاحيتك — انظر أسفل «رفع إلى GitHub»).
2. في Railway: **+ New → GitHub Repo** واختر المستودع. سيكتشف `Dockerfile` تلقائيًا.

**ب) عبر CLI (رفع مباشر بلا GitHub):**
```bash
railway login          # يفتح المتصفح لتسجيل دخولك
railway link           # اربط المجلد بالمشروع
railway up             # يبني وينشر من مجلدك مباشرة
```

### 3) اضبط متغيّرات البيئة (تبويب Variables للخدمة)
| المتغيّر | القيمة |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (ربط بإضافة Postgres) |
| `NEXTAUTH_SECRET` | قيمة عشوائية → `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<اسم-الخدمة>.up.railway.app` (بعد توليد النطاق) |
| `CRON_SECRET` | قيمة عشوائية أخرى |
| `NODE_ENV` | `production` |

> `NEXTAUTH_URL` يحتاج النطاق النهائي — ولّد النطاق من **Settings → Networking → Generate Domain**
> ثم ضع العنوان هنا وأعد النشر.

### 4) البذور الأولية (اختياري، أول مرة)
`prisma migrate deploy` يبني الجداول لكنه **لا** يزرع بيانات. لإنشاء المستخدمين الأوائل:
```bash
railway run npm run seed
```
> ⚠️ `seed.ts` بيانات تجريبية (كلمة المرور `Test1234`). **غيّر كلمات المرور فورًا** بعد أول دخول،
> أو عدّل البذرة لتنشئ مسؤول نظام واحدًا بكلمة مرور قوية قبل الإنتاج.

### 5) جدولة الكرون (الإشعارات + شبكة أمان الحذف)
أنشئ **Cron** في Railway يستدعي دوريًا (مثلًا كل ساعة):
```
curl -H "x-cron-secret: $CRON_SECRET" https://<نطاقك>/api/cron/notifications
```

## ⚠️ نقطتان حرجتان قبل الإنتاج الفعلي

1. **رفع المستندات عابر**: المستندات تُكتب على `public/uploads/` (قرص الحاوية)، وهو **يُمحى عند كل
   إعادة نشر/تشغيل** على Railway. الحلّان: (أ) اربط **Railway Volume** على `/app/public/uploads`
   كحلّ مؤقت، أو (ب) الأفضل: أكمِل ترحيل التخزين إلى Cloudflare R2 (مدرج في خارطة الطريق).
2. **Puppeteer**: مُعالَج عبر `Dockerfile` (مكتبات Chromium مثبّتة). إن رأيت أخطاء توليد PDF،
   تحقّق من سجلّات الخدمة أنّ Chromium أُنزِل أثناء `npm ci`.

## استكشاف الأخطاء
- **فشل الهجرات عند الإقلاع**: تأكّد أنّ `DATABASE_URL` مضبوط ويشير لقاعدة Railway.
- **500 بعد النشر**: راجع أنّ `NEXTAUTH_SECRET` و`NEXTAUTH_URL` مضبوطان (خطأ شائع).
- **بناء بطيء**: أول بناء يُنزّل Chromium (~150MB) — طبيعي.
