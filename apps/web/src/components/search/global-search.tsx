'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/hooks/use-workspace'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Users, 
  Mail, 
  Target,
  FileText,
  Loader2
} from 'lucide-react'

interface SearchResult {
  id: string
  title: string
  description: string
  type: 'lead' | 'campaign' | 'template' | 'contact'
  url: string
  icon: React.ComponentType<{ className?: string }>
}

interface GlobalSearchProps {
  placeholder?: string
  className?: string
}

export function GlobalSearch({ 
  placeholder = "Search leads, campaigns, templates...",
  className 
}: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { workspace } = useWorkspace()
  const router = useRouter()

  // Open/close with keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Search function
  const performSearch = async (searchQuery: string) => {
    if (!workspace?.id || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      // Search across multiple endpoints
      const [leadsResponse, campaignsResponse, templatesResponse] = await Promise.allSettled([
        api.leads.list(workspace.id, { search: searchQuery, limit: '5' }),
        api.campaigns.list(workspace.id, { search: searchQuery, limit: '5' }),
        // Note: Templates endpoint doesn't exist yet, will gracefully fail
        fetch(`/api/workspaces/${workspace.id}/templates?search=${searchQuery}&limit=5`)
          .then(res => res.ok ? res.json() : { data: [] })
          .catch(() => ({ data: [] }))
      ])

      const searchResults: SearchResult[] = []

      // Process leads
      if (leadsResponse.status === 'fulfilled' && leadsResponse.value.data) {
        leadsResponse.value.data.forEach((lead: any) => {
          searchResults.push({
            id: lead.id,
            title: lead.name || lead.email,
            description: `${lead.company || 'No company'} • ${lead.email}`,
            type: 'lead',
            url: `/leads/${lead.id}`,
            icon: Users
          })
        })
      }

      // Process campaigns
      if (campaignsResponse.status === 'fulfilled' && campaignsResponse.value.data) {
        campaignsResponse.value.data.forEach((campaign: any) => {
          searchResults.push({
            id: campaign.id,
            title: campaign.name,
            description: `Campaign • ${campaign.status} • ${campaign.metrics?.total_leads || 0} leads`,
            type: 'campaign',
            url: `/campaigns/${campaign.id}`,
            icon: Target
          })
        })
      }

      // Process templates
      if (templatesResponse.status === 'fulfilled' && templatesResponse.value.data) {
        templatesResponse.value.data.forEach((template: any) => {
          searchResults.push({
            id: template.id,
            title: template.name,
            description: `Template • ${template.category || 'General'}`,
            type: 'template',
            url: `/templates/${template.id}`,
            icon: FileText
          })
        })
      }

      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        performSearch(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, workspace?.id])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    router.push(result.url)
  }

  return (
    <>
      {/* Search Input */}
      <div className={cn("relative", className)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          className="pl-10 w-full cursor-pointer"
          onClick={() => setOpen(true)}
          value=""
          readOnly
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}
          
          {!isLoading && query && results.length === 0 && (
            <CommandEmpty>
              No results found for &quot;{query}&quot;
            </CommandEmpty>
          )}

          {!isLoading && results.length > 0 && (
            <>
              {/* Group by type */}
              {results.filter(r => r.type === 'lead').length > 0 && (
                <CommandGroup heading="Leads">
                  {results
                    .filter(r => r.type === 'lead')
                    .map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.title}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-2 p-2"
                      >
                        <result.icon className="h-4 w-4 text-blue-500" />
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}

              {results.filter(r => r.type === 'campaign').length > 0 && (
                <CommandGroup heading="Campaigns">
                  {results
                    .filter(r => r.type === 'campaign')
                    .map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.title}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-2 p-2"
                      >
                        <result.icon className="h-4 w-4 text-green-500" />
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}

              {results.filter(r => r.type === 'template').length > 0 && (
                <CommandGroup heading="Templates">
                  {results
                    .filter(r => r.type === 'template')
                    .map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.title}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-2 p-2"
                      >
                        <result.icon className="h-4 w-4 text-purple-500" />
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
            </>
          )}

          {!query && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type to search leads, campaigns, and templates...
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}