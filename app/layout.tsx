import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House Tracker",
  description: "Track and rank realestate.com.au listings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
