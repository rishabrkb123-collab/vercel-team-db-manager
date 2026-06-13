import type { Metadata } from "next";
import "./globals.css";
import { HistoryProvider } from "@/lib/history";

export const metadata: Metadata = {
  title: "Vercel DB Manager",
  description: "Postgres database manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <HistoryProvider>{children}</HistoryProvider>
      </body>
    </html>
  );
}
