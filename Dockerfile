# ميزان — Dockerfile للنشر على Railway
# Next.js 16 + Prisma 7 (driver adapter) + Puppeteer (توليد PDF)
FROM node:22-bookworm-slim

# مكتبات النظام التي يحتاجها Chromium (Puppeteer) لتوليد PDF على الخادم.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 \
      libcups2 libdrm2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libx11-6 libxcb1 libxext6 libxi6 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- 1) التبعيات (يشمل تنزيل Chromium المطابق لإصدار puppeteer) ----
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
