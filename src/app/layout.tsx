import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import "./globals.css";
import "@/components/inbox-workspace.css";
import "@/components/workspace-settings.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A clear view of your outreach results.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
