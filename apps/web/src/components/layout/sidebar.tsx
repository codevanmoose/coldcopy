'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import {
  Home,
  Users,
  Mail,
  BarChart3,
  Settings,
  Inbox,
  Target,
  Building,
  Shield,
  FileText,
  CreditCard,
  Activity,
  Brain,
  Sparkles,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Campaigns', href: '/campaigns', icon: Target },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Email Deliverability', href: '/deliverability', icon: Shield },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Sales Intelligence', href: '/intelligence', icon: Brain },
  { name: 'Privacy', href: '/privacy', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Test API', href: '/test-api', icon: Activity }, // Temporary for testing
  { name: 'AI Dashboard', href: '/ai-dashboard', icon: Sparkles }, // AI features overview
]

const adminNavigation = [
  { name: 'Admin Overview', href: '/admin/overview', icon: BarChart3 },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Workspaces', href: '/admin/workspaces', icon: Building },
  { name: 'Billing', href: '/admin/billing', icon: CreditCard },
  { name: 'Analytics', href: '/admin/analytics', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const { dbUser, workspace } = useAuthStore()
  const isSuperAdmin = dbUser?.role === 'super_admin'

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border lg:block hidden">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center px-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ColdCopy</span>
          </Link>
        </div>
        
        {workspace && (
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <p className="text-sm font-semibold truncate">{workspace.name}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
          
          {isSuperAdmin && (
            <>
              <div className="my-4 border-t border-border" />
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </p>
              {adminNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </>
          )}
        </nav>
        
        <div className="border-t border-border p-4">
          <div className="space-y-2">
            <Link
              href="/privacy"
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Center
            </Link>
            <Link
              href="/privacy-policy"
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            © 2024 ColdCopy
          </p>
        </div>
      </div>
    </div>
  )
}