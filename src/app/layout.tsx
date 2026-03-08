import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";

import { ThemeToggle } from "~/app/_components/theme-toggle";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Cryptics",
  description: "Play cryptic crosswords online",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            const storageKey = "cryptics-theme";
            const storedTheme = localStorage.getItem(storageKey);
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;
            document.documentElement.classList.toggle("dark", shouldUseDark);
          })();`}
        </Script>
      </head>
      <body>
        <TRPCReactProvider>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
