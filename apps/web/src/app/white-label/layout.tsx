/**
 * White-Label Layout
 * 
 * Layout for white-label domains with custom branding and navigation
 */

import { headers } from "next/headers";
import { WhiteLabelHeader } from "../../components/white-label/white-label-header";
import { WhiteLabelSidebar } from "../../components/white-label/white-label-sidebar";
import { isWhiteLabelRequest, getWorkspaceFromHeaders } from "../../lib/white-label/domain-resolver";

interface WhiteLabelLayoutProps {
  children: React.ReactNode;
}

export default async function WhiteLabelLayout({ children }: WhiteLabelLayoutProps) {
  const headersList = headers();
  const isWhiteLabel = isWhiteLabelRequest(headersList);
  const workspaceId = getWorkspaceFromHeaders(headersList);
  
  // Extract branding from headers
  const branding = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : 'ColdCopy',
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    primaryColor: headersList.get('x-brand-primary-color') || '#2563eb',
    secondaryColor: headersList.get('x-brand-secondary-color') || '#64748b',
  };

  // Check if this is a dashboard route
  const pathname = headersList.get('x-pathname') || '';
  const isDashboard = pathname.startsWith('/white-label/dashboard') || 
                    pathname.startsWith('/white-label/admin');

  if (isDashboard) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <WhiteLabelSidebar 
          branding={branding}
          workspaceId={workspaceId}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <WhiteLabelHeader 
            branding={branding}
            workspaceId={workspaceId}
          />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // For non-dashboard routes (login, signup, landing, etc.)
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <WhiteLabelHeader 
        branding={branding}
        workspaceId={workspaceId}
        simplified={true}
      />
      <main>{children}</main>
    </div>
  );
}