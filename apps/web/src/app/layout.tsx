import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import { WhiteLabelProvider } from "../components/white-label/white-label-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Dynamic metadata generation based on white-label context
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const isWhiteLabel = headersList.get('x-white-label') === 'true';
  const companyName = headersList.get('x-brand-company') ? 
    decodeURIComponent(headersList.get('x-brand-company')!) : null;

  if (isWhiteLabel && companyName) {
    return {
      title: `${companyName} - AI-Powered Cold Outreach Platform`,
      description: `Transform generic outreach into personalized conversations that convert with ${companyName}'s AI-powered cold email automation.`,
      manifest: "/manifest.json",
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: companyName,
      },
      formatDetection: {
        telephone: false,
      },
      openGraph: {
        title: `${companyName} - AI-Powered Cold Outreach Platform`,
        description: "Transform generic outreach into personalized conversations that convert.",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${companyName} - AI-Powered Cold Outreach Platform`,
        description: "Transform generic outreach into personalized conversations that convert.",
      },
    };
  }

  // Default metadata
  return {
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
  };
}

export function generateViewport(): Viewport {
  const headersList = headers();
  const primaryColor = headersList.get('x-brand-primary-color') || "#0F172A";

  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: primaryColor },
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const isWhiteLabel = headersList.get('x-white-label') === 'true';
  const workspaceId = headersList.get('x-workspace-id');
  const domain = headersList.get('x-domain');
  const faviconUrl = headersList.get('x-brand-favicon') ? 
    decodeURIComponent(headersList.get('x-brand-favicon')!) : null;

  // Extract branding information from headers
  const brandingHeaders = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : null,
    primaryColor: headersList.get('x-brand-primary-color'),
    secondaryColor: headersList.get('x-brand-secondary-color'),
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    faviconUrl,
  };

  return (
    <html lang="en" className="dark">
      <head>
        {/* Dynamic favicon based on white-label */}
        {faviconUrl ? (
          <>
            <link rel="icon" href={faviconUrl} sizes="any" />
            <link rel="apple-touch-icon" href={faviconUrl} />
          </>
        ) : (
          <>
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="icon" href="/icon.svg" type="image/svg+xml" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          </>
        )}
        
        {/* Inject white-label custom CSS */}
        {isWhiteLabel && (
          <style
            dangerouslySetInnerHTML={{
              __html: generateWhiteLabelCSS(brandingHeaders),
            }}
          />
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <WhiteLabelProvider
          isWhiteLabel={isWhiteLabel}
          workspaceId={workspaceId}
          domain={domain}
          branding={brandingHeaders}
        >
          {children}
        </WhiteLabelProvider>
        
        <Toaster 
          richColors 
          theme="dark" 
          position="top-right"
          style={isWhiteLabel && brandingHeaders.primaryColor ? {
            '--toast-primary': brandingHeaders.primaryColor
          } as React.CSSProperties : undefined}
        />
        
        <Script
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

/**
 * Generate white-label CSS from branding headers
 */
function generateWhiteLabelCSS(branding: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
}): string {
  const css: string[] = [':root {'];

  if (branding.primaryColor) {
    css.push(`  --color-primary: ${branding.primaryColor};`);
    css.push(`  --color-primary-foreground: ${getContrastColor(branding.primaryColor)};`);
  }

  if (branding.secondaryColor) {
    css.push(`  --color-secondary: ${branding.secondaryColor};`);
    css.push(`  --color-secondary-foreground: ${getContrastColor(branding.secondaryColor)};`);
  }

  css.push('}');

  // Add additional CSS for white-label styling
  if (branding.primaryColor) {
    css.push(`
      .btn-primary, button[data-primary="true"] {
        background-color: ${branding.primaryColor} !important;
        border-color: ${branding.primaryColor} !important;
      }
      
      .text-primary {
        color: ${branding.primaryColor} !important;
      }
      
      .border-primary {
        border-color: ${branding.primaryColor} !important;
      }
      
      .bg-primary {
        background-color: ${branding.primaryColor} !important;
      }
    `);
  }

  return css.join('\n');
}

/**
 * Get contrast color (white or black) based on background color
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
