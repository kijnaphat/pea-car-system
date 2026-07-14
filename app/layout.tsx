import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react"; // ✅ 1. เพิ่มบรรทัดนี้
import GlobalBottomNav from "./components/GlobalBottomNav";

export const metadata: Metadata = {
  title: "PEA Smart Car",
  description: "ระบบจัดการยานพาหนะ PEA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">
        {/* ✅ 2. ครอบ children ด้วย Suspense */}
        <Suspense fallback={<div className="p-10 text-center text-[#742F99]">กำลังโหลดระบบ...</div>}>
          {children}
          <div className="h-[78px] print:hidden" aria-hidden="true" />
          <GlobalBottomNav />
        </Suspense>
      </body>
    </html>
  );
}
