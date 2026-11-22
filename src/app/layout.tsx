import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Secrets",
  description: "Share a secret that can be viewed once.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request render so Next can apply the CSP nonce from src/proxy.ts.
  await connection();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-16 md:py-24">
          {children}
          <p className="text-xs text-muted-foreground">
            Encrypted in your browser. The server never sees your secret. Destroyed after one view.
          </p>
        </main>
      </body>
    </html>
  );
}
