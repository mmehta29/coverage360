import type { Metadata } from "next";
import { Providers } from "./providers";
// @ts-expect-error css side-effect import
import "./globals.css";

export const metadata: Metadata = {
  title: "Coverage360 - Analyst Portal",
  description: "Medical Benefit Drug Policy Analysis - Innovation Hacks 2.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
