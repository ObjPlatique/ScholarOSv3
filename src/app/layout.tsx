import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScholarOS",
  description: "AI-powered study and productivity workspace",
};

const themeScript = `(() => {
  try {
    const saved = localStorage.getItem("scholaros-theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
  } catch (_) {}
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
