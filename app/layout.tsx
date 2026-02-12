import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react"; // ✅ 1. เพิ่มบรรทัดนี้

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ 2. ครอบ children ด้วย Suspense */}
        <Suspense fallback={<div className="p-10 text-center text-[#742F99]">กำลังโหลดระบบ...</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}