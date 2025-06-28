'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Command,
  User,
  Mail,
  BarChart3,
  Settings,
  Home,
  Users,
  MessageSquare,
  Zap,
  Plus,
  FileText,
  Calendar,
  Bell,
  Download,
  Upload,
  Archive,
  Trash2,
  Copy,
  ExternalLink,
  Keyboard,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { useShortcuts, formatShortcutKeys } from '@/lib/shortcuts/shortcut-provider'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme/theme-provider'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: string
  icon: React.ReactNode
  action: () => void
  shortcut?: string[]
  keywords?: string[]
}

export function CommandPalette() {
  const { 
    isCommandPaletteOpen, 
    setCommandPaletteOpen, 
    searchQuery, 
    setSearchQuery,
    shortcuts 
  } = useShortcuts()
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      subtitle: 'Go to dashboard home',
      category: 'Navigation',
      icon: <Home className="h-4 w-4" />,
      action: () => router.push('/dashboard'),
      shortcut: ['g', 'h'],
      keywords: ['home', 'overview']
    },
    {
      id: 'nav-leads',
      title: 'Leads',
      subtitle: 'Manage your leads',
      category: 'Navigation',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push('/leads'),
      shortcut: ['g', 'l'],
      keywords: ['contacts', 'prospects']
    },
    {
      id: 'nav-campaigns',
      title: 'Campaigns',
      subtitle: 'Email campaigns and sequences',
      category: 'Navigation',
      icon: <Mail className="h-4 w-4" />,
      action: () => router.push('/campaigns'),
      shortcut: ['g', 'c'],
      keywords: ['email', 'sequences']
    },
    {
      id: 'nav-inbox',
      title: 'Inbox',
      subtitle: 'Team shared inbox',
      category: 'Navigation',
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => router.push('/inbox'),
      shortcut: ['g', 'i'],
      keywords: ['messages', 'replies']
    },
    {
      id: 'nav-analytics',
      title: 'Analytics',
      subtitle: 'Performance metrics and reports',
      category: 'Navigation',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => router.push('/analytics'),
      shortcut: ['g', 'a'],
      keywords: ['reports', 'metrics', 'statistics']
    },
    {
      id: 'nav-integrations',
      title: 'Integrations',
      subtitle: 'Connect third-party services',
      category: 'Navigation',
      icon: <Zap className="h-4 w-4" />,
      action: () => router.push('/integrations'),
      shortcut: ['g', 't'],
      keywords: ['connections', 'apps', 'services']
    },
    {
      id: 'nav-settings',
      title: 'Settings',
      subtitle: 'Account and workspace settings',
      category: 'Navigation',
      icon: <Settings className="h-4 w-4" />,
      action: () => router.push('/settings'),
      shortcut: ['g', 's'],
      keywords: ['preferences', 'configuration']
    },

    // Quick Actions
    {
      id: 'action-new-lead',
      title: 'New Lead',
      subtitle: 'Add a new lead to your database',
      category: 'Quick Actions',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push('/leads?action=new'),
      shortcut: ['n', 'l'],
      keywords: ['create', 'add', 'contact']
    },
    {
      id: 'action-new-campaign',
      title: 'New Campaign',
      subtitle: 'Create a new email campaign',
      category: 'Quick Actions',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push('/campaigns?action=new'),
      shortcut: ['n', 'c'],
      keywords: ['create', 'email', 'sequence']
    },
    {
      id: 'action-import-leads',
      title: 'Import Leads',
      subtitle: 'Upload CSV file to import leads',
      category: 'Quick Actions',
      icon: <Upload className="h-4 w-4" />,
      action: () => router.push('/leads?action=import'),
      keywords: ['upload', 'csv', 'bulk']
    },
    {
      id: 'action-export-data',
      title: 'Export Data',
      subtitle: 'Download your data as CSV',
      category: 'Quick Actions',
      icon: <Download className="h-4 w-4" />,
      action: () => router.push('/settings/export'),
      keywords: ['download', 'backup', 'csv']
    },

    // Theme Controls
    {
      id: 'theme-light',
      title: 'Light Theme',
      subtitle: 'Switch to light mode',
      category: 'Appearance',
      icon: <Sun className="h-4 w-4" />,
      action: () => setTheme('light'),
      keywords: ['appearance', 'bright']
    },
    {
      id: 'theme-dark',
      title: 'Dark Theme',
      subtitle: 'Switch to dark mode',
      category: 'Appearance',
      icon: <Moon className="h-4 w-4" />,
      action: () => setTheme('dark'),
      keywords: ['appearance', 'night']
    },
    {
      id: 'theme-system',
      title: 'System Theme',
      subtitle: 'Follow system preference',
      category: 'Appearance',
      icon: <Monitor className="h-4 w-4" />,
      action: () => setTheme('system'),
      keywords: ['appearance', 'auto']
    },

    // Help & Support
    {
      id: 'help-shortcuts',
      title: 'Keyboard Shortcuts',
      subtitle: 'View all available shortcuts',
      category: 'Help',
      icon: <Keyboard className="h-4 w-4" />,
      action: () => {
        setSearchQuery('shortcuts')
        setSelectedIndex(0)
      },
      shortcut: ['?'],
      keywords: ['help', 'keys', 'hotkeys']
    },
    {
      id: 'help-documentation',
      title: 'Documentation',
      subtitle: 'Open help documentation',
      category: 'Help',
      icon: <FileText className="h-4 w-4" />,
      action: () => window.open('/docs', '_blank'),
      keywords: ['help', 'guide', 'manual']
    },
    {
      id: 'help-support',
      title: 'Contact Support',
      subtitle: 'Get help from our team',
      category: 'Help',
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => window.open('mailto:support@coldcopy.cc', '_blank'),
      keywords: ['help', 'contact', 'assistance']
    },

    // Workspace Management
    {
      id: 'workspace-billing',
      title: 'Billing & Usage',
      subtitle: 'View subscription and usage',
      category: 'Workspace',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push('/settings/billing'),
      keywords: ['subscription', 'payment', 'usage']
    },
    {
      id: 'workspace-team',
      title: 'Team Members',
      subtitle: 'Manage team access',
      category: 'Workspace',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push('/settings/team'),
      keywords: ['users', 'permissions', 'invite']
    },
    {
      id: 'workspace-api',
      title: 'API Settings',
      subtitle: 'Manage API keys and webhooks',
      category: 'Workspace',
      icon: <Zap className="h-4 w-4" />,
      action: () => router.push('/settings/api'),
      keywords: ['api', 'webhooks', 'integration']
    }
  ], [router, setTheme])

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return allCommands
    }

    // Special case for shortcuts view
    if (searchQuery.toLowerCase().includes('shortcut')) {
      return shortcuts.map(shortcut => ({
        id: `shortcut-${shortcut.id}`,
        title: shortcut.description,
        subtitle: `Category: ${shortcut.category}`,
        category: 'Shortcuts',
        icon: <Keyboard className="h-4 w-4" />,
        action: shortcut.action,
        shortcut: shortcut.keys,
        keywords: [shortcut.category.toLowerCase(), ...shortcut.keys]
      }))
    }

    const query = searchQuery.toLowerCase()
    return allCommands.filter(command => {
      const searchableText = [
        command.title,
        command.subtitle || '',
        command.category,
        ...(command.keywords || [])
      ].join(' ').toLowerCase()
      
      return searchableText.includes(query)
    })
  }, [searchQuery, allCommands, shortcuts])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    filteredCommands.forEach(command => {
      if (!groups[command.category]) {
        groups[command.category] = []
      }
      groups[command.category].push(command)
    })
    return groups
  }, [filteredCommands])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selectedCommand = filteredCommands[selectedIndex]
        if (selectedCommand) {
          selectedCommand.action()
          setCommandPaletteOpen(false)
          setSearchQuery('')
          setSelectedIndex(0)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex, setCommandPaletteOpen, setSearchQuery])

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  const handleItemClick = (command: CommandItem) => {
    command.action()
    setCommandPaletteOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  const handleClose = () => {
    setCommandPaletteOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  return (
    <Dialog open={isCommandPaletteOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <Input
            placeholder="Type a command or search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            autoFocus
          />
          <div className="flex items-center space-x-1 text-xs text-muted-foreground ml-3">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span>⌘</span>K
            </kbd>
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No commands found for "{searchQuery}"
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for navigation, actions, or help
              </p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category} className="mb-2">
                  <div className="px-4 py-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                  </div>
                  <div>
                    {commands.map((command, index) => {
                      const globalIndex = filteredCommands.indexOf(command)
                      const isSelected = globalIndex === selectedIndex
                      
                      return (
                        <div
                          key={command.id}
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                          }`}
                          onClick={() => handleItemClick(command)}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              {command.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {command.title}
                              </div>
                              {command.subtitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {command.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          {command.shortcut && (
                            <div className="flex-shrink-0 ml-3">
                              <Badge variant="outline" className="text-xs">
                                {formatShortcutKeys(command.shortcut)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                  ↵
                </kbd>{' '}
                Select
              </span>
              <span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                  esc
                </kbd>{' '}
                Close
              </span>
            </div>
            <div className="text-muted-foreground">
              {filteredCommands.length} commands
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}