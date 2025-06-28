'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { formatShortcutKeys } from '@/lib/shortcuts/shortcut-provider'
import {
  Home,
  Users,
  Mail,
  MessageSquare,
  BarChart3,
  Settings,
  Zap,
  User,
  Bell,
  Search,
  Plus,
  Command
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  shortcut?: string[]
  description?: string
}

interface SidebarProps {
  onCommandPaletteOpen?: () => void
}

export function EnhancedSidebar({ onCommandPaletteOpen }: SidebarProps) {
  const pathname = usePathname()

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      shortcut: ['g', 'h'],
      description: 'Overview and quick stats'
    },
    {
      name: 'Leads',
      href: '/leads',
      icon: Users,
      shortcut: ['g', 'l'],
      description: 'Manage your prospects'
    },
    {
      name: 'Campaigns',
      href: '/campaigns',
      icon: Mail,
      shortcut: ['g', 'c'],
      description: 'Email sequences and campaigns'
    },
    {
      name: 'Inbox',
      href: '/inbox',
      icon: MessageSquare,
      badge: 3,
      shortcut: ['g', 'i'],
      description: 'Team shared inbox'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      shortcut: ['g', 'a'],
      description: 'Performance insights'
    },
    {
      name: 'Integrations',
      href: '/integrations',
      icon: Zap,
      shortcut: ['g', 't'],
      description: 'Connect your tools'
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      shortcut: ['g', 's'],
      description: 'Account & workspace settings'
    }
  ]

  const quickActions = [
    {
      name: 'New Lead',
      action: () => window.location.href = '/leads?action=new',
      icon: Plus,
      shortcut: ['n', 'l']
    },
    {
      name: 'New Campaign',
      action: () => window.location.href = '/campaigns?action=new',
      icon: Plus,
      shortcut: ['n', 'c']
    }
  ]

  return (
    <div className="flex h-full w-64 flex-col bg-background border-r">
      {/* Logo and Brand */}
      <div className="flex h-16 items-center px-6 border-b">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Mail className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">ColdCopy</span>
        </div>
      </div>

      {/* Command Palette Trigger */}
      <div className="px-4 py-4">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={onCommandPaletteOpen}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="flex-1 text-left">Search commands...</span>
          <Badge variant="outline" className="text-xs">
            {formatShortcutKeys(['cmd', 'k'])}
          </Badge>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                title={item.description}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-4 w-4 flex-shrink-0',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <Badge 
                    variant={isActive ? "secondary" : "outline"} 
                    className="h-5 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.shortcut && (
                  <div className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity ml-auto",
                    isActive && "opacity-100"
                  )}>
                    <Badge variant="outline" className="text-xs">
                      {formatShortcutKeys(item.shortcut)}
                    </Badge>
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <Button
                key={action.name}
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={action.action}
              >
                <action.icon className="mr-3 h-4 w-4" />
                <span className="flex-1 text-left">{action.name}</span>
                <Badge variant="outline" className="text-xs">
                  {formatShortcutKeys(action.shortcut)}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">
                john@company.com
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
        
        {/* Keyboard Shortcuts Hint */}
        <div className="text-xs text-muted-foreground text-center">
          Press{' '}
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
            ?
          </kbd>{' '}
          for shortcuts
        </div>
      </div>
    </div>
  )
}