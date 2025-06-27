'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Building, Users, Palette, Key, CreditCard, Bell, Mail, Sparkles, Crown, Plug } from 'lucide-react'

const items = [
  {
    title: 'Workspace',
    href: '/settings',
    icon: Building,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Team',
    href: '/settings/team',
    icon: Users,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Email',
    href: '/settings/email',
    icon: Mail,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'AI Settings',
    href: '/settings/ai',
    icon: Sparkles,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Integrations',
    href: '/settings/integrations/hubspot',
    icon: Plug,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Branding',
    href: '/settings/branding',
    icon: Palette,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'White-Label',
    href: '/settings/white-label',
    icon: Crown,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'API Keys',
    href: '/settings/api-keys',
    icon: Key,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Billing',
    href: '/settings/billing',
    icon: CreditCard,
    roles: ['workspace_admin', 'super_admin'],
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    roles: ['workspace_admin', 'campaign_manager', 'outreach_specialist', 'super_admin'],
  },
]

export function SettingsNav() {
  const pathname = usePathname()
  const { dbUser } = useAuthStore()
  const userRole = dbUser?.role

  const visibleItems = items.filter(item => 
    userRole && item.roles.includes(userRole)
  )

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            pathname === item.href
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground'
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  )
}