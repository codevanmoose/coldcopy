'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
  showHome?: boolean
}

export function EnhancedBreadcrumb({ 
  items, 
  className, 
  showHome = true 
}: BreadcrumbProps) {
  const pathname = usePathname()
  
  // Generate breadcrumb items from pathname if not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname)
  
  return (
    <nav className={cn('flex items-center space-x-1 text-sm', className)}>
      {showHome && (
        <>
          <Link
            href="/dashboard"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          {breadcrumbItems.length > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </>
      )}
      
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1
        const isCurrent = item.current || isLast
        
        return (
          <React.Fragment key={index}>
            {item.href && !isCurrent ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(
                isCurrent 
                  ? 'text-foreground font-medium' 
                  : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            )}
            
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// Helper function to generate breadcrumbs from pathname
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  
  // Route name mappings for better labels
  const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    campaigns: 'Campaigns',
    inbox: 'Inbox',
    analytics: 'Analytics',
    integrations: 'Integrations',
    settings: 'Settings',
    billing: 'Billing',
    team: 'Team',
    api: 'API',
    profile: 'Profile',
    notifications: 'Notifications',
    security: 'Security',
    export: 'Export',
    import: 'Import',
    templates: 'Templates',
    sequences: 'Sequences',
    reports: 'Reports',
    performance: 'Performance',
    deliverability: 'Deliverability'
  }
  
  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = routeLabels[segment] || capitalizeFirstLetter(segment)
    
    return {
      label,
      href: index === segments.length - 1 ? undefined : href,
      current: index === segments.length - 1
    }
  })
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// Breadcrumb with dropdown for long paths
interface DropdownBreadcrumbProps extends BreadcrumbProps {
  maxItems?: number
}

export function DropdownBreadcrumb({ 
  items, 
  className, 
  showHome = true,
  maxItems = 3
}: DropdownBreadcrumbProps) {
  const pathname = usePathname()
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname)
  
  if (breadcrumbItems.length <= maxItems) {
    return (
      <EnhancedBreadcrumb 
        items={breadcrumbItems} 
        className={className} 
        showHome={showHome} 
      />
    )
  }
  
  const firstItem = breadcrumbItems[0]
  const lastItems = breadcrumbItems.slice(-2)
  const hiddenItems = breadcrumbItems.slice(1, -2)
  
  return (
    <nav className={cn('flex items-center space-x-1 text-sm', className)}>
      {showHome && (
        <>
          <Link
            href="/dashboard"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      
      {/* First item */}
      {firstItem.href ? (
        <Link
          href={firstItem.href}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {firstItem.label}
        </Link>
      ) : (
        <span className="text-muted-foreground">{firstItem.label}</span>
      )}
      
      {/* Ellipsis for hidden items */}
      {hiddenItems.length > 0 && (
        <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">...</span>
        </>
      )}
      
      {/* Last items */}
      {lastItems.map((item, index) => {
        const isLast = index === lastItems.length - 1
        const isCurrent = item.current || isLast
        
        return (
          <React.Fragment key={`last-${index}`}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {item.href && !isCurrent ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(
                isCurrent 
                  ? 'text-foreground font-medium' 
                  : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}