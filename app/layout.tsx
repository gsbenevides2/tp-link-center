import type { Metadata } from "next";
import { Arimo } from "next/font/google";
import "@/app/globals.css";
import { displayName, description } from "@/package.json";
import { Header } from "@/app/components/Header";
import { Providers } from "@/app/providers";

const openSans = Arimo({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: displayName,
  description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className={`${openSans.variable}`}>
      <body className="">
        <Providers>
          <Header />
          <main className="px-12 pt-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
