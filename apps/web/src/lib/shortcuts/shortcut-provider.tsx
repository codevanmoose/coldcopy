'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Shortcut {
  id: string
  keys: string[]
  description: string
  category: string
  action: () => void
  global?: boolean
}

interface ShortcutContextType {
  shortcuts: Shortcut[]
  registerShortcut: (shortcut: Shortcut) => void
  unregisterShortcut: (id: string) => void
  isCommandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined)

export function useShortcuts() {
  const context = useContext(ShortcutContext)
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider')
  }
  return context
}

interface ShortcutProviderProps {
  children: React.ReactNode
}

export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts(prev => {
      const existing = prev.find(s => s.id === shortcut.id)
      if (existing) {
        return prev.map(s => s.id === shortcut.id ? shortcut : s)
      }
      return [...prev, shortcut]
    })
  }, [])

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id))
  }, [])

  // Key combination parser
  const parseKeys = (keys: string[]): { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } => {
    const modifiers = { ctrl: false, alt: false, shift: false, meta: false }
    let key = ''

    keys.forEach(k => {
      const lower = k.toLowerCase()
      if (lower === 'ctrl' || lower === 'control') modifiers.ctrl = true
      else if (lower === 'alt' || lower === 'option') modifiers.alt = true
      else if (lower === 'shift') modifiers.shift = true
      else if (lower === 'meta' || lower === 'cmd' || lower === 'command') modifiers.meta = true
      else key = lower
    })

    return { key, ...modifiers }
  }

  // Key event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only allow global shortcuts
        const globalShortcuts = shortcuts.filter(s => s.global)
        for (const shortcut of globalShortcuts) {
          const parsed = parseKeys(shortcut.keys)
          if (
            event.key.toLowerCase() === parsed.key &&
            event.ctrlKey === parsed.ctrl &&
            event.altKey === parsed.alt &&
            event.shiftKey === parsed.shift &&
            event.metaKey === parsed.meta
          ) {
            event.preventDefault()
            shortcut.action()
            return
          }
        }
        return
      }

      // Check all shortcuts
      for (const shortcut of shortcuts) {
        const parsed = parseKeys(shortcut.keys)
        if (
          event.key.toLowerCase() === parsed.key &&
          event.ctrlKey === parsed.ctrl &&
          event.altKey === parsed.alt &&
          event.shiftKey === parsed.shift &&
          event.metaKey === parsed.meta
        ) {
          event.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])

  // Register default shortcuts
  useEffect(() => {
    const defaultShortcuts: Shortcut[] = [
      {
        id: 'command-palette',
        keys: ['ctrl', 'k'],
        description: 'Open command palette',
        category: 'General',
        action: () => setCommandPaletteOpen(true),
        global: true
      },
      {
        id: 'command-palette-meta',
        keys: ['meta', 'k'],
        description: 'Open command palette',
        category: 'General',
        action: () => setCommandPaletteOpen(true),
        global: true
      },
      {
        id: 'escape-close',
        keys: ['escape'],
        description: 'Close dialogs/command palette',
        category: 'General',
        action: () => {
          if (isCommandPaletteOpen) {
            setCommandPaletteOpen(false)
            setSearchQuery('')
          }
        },
        global: true
      },
      {
        id: 'home',
        keys: ['g', 'h'],
        description: 'Go to dashboard',
        category: 'Navigation',
        action: () => router.push('/dashboard')
      },
      {
        id: 'leads',
        keys: ['g', 'l'],
        description: 'Go to leads',
        category: 'Navigation',
        action: () => router.push('/leads')
      },
      {
        id: 'campaigns',
        keys: ['g', 'c'],
        description: 'Go to campaigns',
        category: 'Navigation',
        action: () => router.push('/campaigns')
      },
      {
        id: 'inbox',
        keys: ['g', 'i'],
        description: 'Go to inbox',
        category: 'Navigation',
        action: () => router.push('/inbox')
      },
      {
        id: 'analytics',
        keys: ['g', 'a'],
        description: 'Go to analytics',
        category: 'Navigation',
        action: () => router.push('/analytics')
      },
      {
        id: 'integrations',
        keys: ['g', 't'],
        description: 'Go to integrations',
        category: 'Navigation',
        action: () => router.push('/integrations')
      },
      {
        id: 'settings',
        keys: ['g', 's'],
        description: 'Go to settings',
        category: 'Navigation',
        action: () => router.push('/settings')
      },
      {
        id: 'new-lead',
        keys: ['n', 'l'],
        description: 'Create new lead',
        category: 'Actions',
        action: () => router.push('/leads?action=new')
      },
      {
        id: 'new-campaign',
        keys: ['n', 'c'],
        description: 'Create new campaign',
        category: 'Actions',
        action: () => router.push('/campaigns?action=new')
      },
      {
        id: 'search',
        keys: ['/'],
        description: 'Search',
        category: 'General',
        action: () => {
          setCommandPaletteOpen(true)
          setSearchQuery('')
        }
      },
      {
        id: 'refresh',
        keys: ['r'],
        description: 'Refresh current page',
        category: 'General',
        action: () => window.location.reload()
      },
      {
        id: 'help',
        keys: ['?'],
        description: 'Show keyboard shortcuts',
        category: 'General',
        action: () => {
          setCommandPaletteOpen(true)
          setSearchQuery('shortcuts')
        }
      }
    ]

    defaultShortcuts.forEach(registerShortcut)

    return () => {
      defaultShortcuts.forEach(shortcut => unregisterShortcut(shortcut.id))
    }
  }, [registerShortcut, unregisterShortcut, router, isCommandPaletteOpen])

  const value = {
    shortcuts,
    registerShortcut,
    unregisterShortcut,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    searchQuery,
    setSearchQuery
  }

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  )
}

// Hook for individual components to register shortcuts
export function useRegisterShortcut(shortcut: Shortcut) {
  const { registerShortcut, unregisterShortcut } = useShortcuts()

  useEffect(() => {
    registerShortcut(shortcut)
    return () => unregisterShortcut(shortcut.id)
  }, [shortcut, registerShortcut, unregisterShortcut])
}

// Utility function to format shortcut keys for display
export function formatShortcutKeys(keys: string[]): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  
  return keys.map(key => {
    const lower = key.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') return isMac ? '⌃' : 'Ctrl'
    if (lower === 'alt' || lower === 'option') return isMac ? '⌥' : 'Alt'
    if (lower === 'shift') return isMac ? '⇧' : 'Shift'
    if (lower === 'meta' || lower === 'cmd' || lower === 'command') return isMac ? '⌘' : 'Win'
    if (lower === 'escape') return 'Esc'
    if (lower === 'enter') return 'Enter'
    if (lower === 'space') return 'Space'
    if (lower === 'backspace') return 'Backspace'
    if (lower === 'delete') return 'Del'
    if (lower === 'tab') return 'Tab'
    if (lower === 'arrowup') return '↑'
    if (lower === 'arrowdown') return '↓'
    if (lower === 'arrowleft') return '←'
    if (lower === 'arrowright') return '→'
    return key.toUpperCase()
  }).join(isMac ? '' : '+')
}