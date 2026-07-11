import type { Metadata } from "next";
import { Tajawal, Amiri } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ميزان | إدارة مكتب المحاماة",
  description: "نظام ميزان لإدارة أعمال شركة قدوم الحقائق للمحاماة والاستشارات القانونية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${amiri.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster
          position="top-left"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "var(--font-tajawal)",
              direction: "rtl",
              background: "#12182B",
              color: "#fff",
            },
            success: { iconTheme: { primary: "#9A7B3C", secondary: "#fff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
