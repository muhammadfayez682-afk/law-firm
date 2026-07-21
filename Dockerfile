# ميزان — Dockerfile للنشر على Railway
# Next.js 16 + Prisma 7 (driver adapter) + Puppeteer (توليد PDF)
FROM node:22-bookworm-slim

# Chromium من حزم النظام (بدل تنزيل puppeteer له) — أمتن وأسرع، ويتجنّب
# مشاكل فكّ الضغط. fonts-liberation لخط لاتيني احتياطي (الخط العربي Amiri مضمّن base64).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation chromium \
    && rm -rf /var/lib/apt/lists/*

# نُخبر puppeteer بألا يُنزّل Chromium، وأن يستخدم نسخة النظام.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# ---- 1) التبعيات ----
# ننسخ ملفات القفل + مخطط Prisma أولًا للاستفادة من ذاكرة طبقات Docker.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# نحتاج devDependencies للبناء (TypeScript/Tailwind/ts-node)، لذا نثبّت الكل.
RUN npm ci --include=dev

# توليد عميل Prisma (يُنفّذ أيضًا عبر postinstall، ونؤكّده هنا صراحةً).
RUN npx prisma generate

# ---- 2) نسخ الكود وبناء التطبيق ----
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# عند الإقلاع: طبّق هجرات قاعدة البيانات ثم شغّل الخادم.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
