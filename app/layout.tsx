import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react"; // ✅ 1. เพิ่มบรรทัดนี้
import GlobalBottomNav from "./components/GlobalBottomNav";

export const metadata: Metadata = {
  title: "PEA Smart Car",
  description: "ระบบจัดการยานพาหนะ PEA",
  applicationName: "PEA Smart Car",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=3",
        sizes: "64x64",
        type: "image/x-icon",
      },
      {
        url: "/favicon-32x32.png?v=3",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: [
      {
        url: "/apple-touch-icon.png?v=3",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "PEA Smart Car",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#702082",
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
          <div className="h-[86px] print:hidden" aria-hidden="true" />
          <GlobalBottomNav />
        </Suspense>
      </body>
    </html>
  );
}
