import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { ShortcutProvider } from "@/lib/shortcuts/shortcut-provider";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Static metadata
export const metadata: Metadata = {
  title: "ColdCopy - AI-Powered Cold Outreach Platform",
  description: "Transform generic outreach into personalized conversations that convert with AI-powered cold email automation.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ColdCopy",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "ColdCopy - AI-Powered Cold Outreach Platform",
    description: "Transform generic outreach into personalized conversations that convert.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ColdCopy - AI-Powered Cold Outreach Platform",
    description: "Transform generic outreach into personalized conversations that convert.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <GoogleAnalytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ShortcutProvider>
            <AnalyticsProvider />
            {children}
            <Toaster 
              richColors 
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                },
              }}
            />
          </ShortcutProvider>
        </ThemeProvider>
        <Script strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}