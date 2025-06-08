import type { Metadata } from "next";
import "./globals.css";
// import { SessionProvider } from "@/components/SessionProvider"; // Removed as NextAuth is replaced by Supabase
import { WalletProvider } from "@/components/WalletProvider";
import { MobileDetectionProvider } from "@/components/MobileDetectionProvider";

export const metadata: Metadata = {
  title: "Candy Machine",
  description: "Convince AI to Win $$",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
        {/* Preload critical assets */}
        <link rel="preload" href="/frames/1.png" as="image" />
        <link rel="preload" href="/Aptos_mark_WHT.png" as="image" />
      </head>
      <body>
        {/* <SessionProvider> */}{/* Removed SessionProvider wrapper */}
          <WalletProvider>
            <MobileDetectionProvider>
              {children}
            </MobileDetectionProvider>
          </WalletProvider>
        {/* </SessionProvider> */}{/* Removed SessionProvider wrapper */}
      </body>
    </html>
  );
}