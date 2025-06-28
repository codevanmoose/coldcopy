'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  BookOpen, 
  Clock, 
  Star,
  ArrowRight,
  X
} from 'lucide-react'
import Link from 'next/link'

interface SearchResult {
  id: string
  title: string
  description: string
  category: string
  url: string
  readTime: string
  popular?: boolean
  keywords: string[]
}

interface SearchWidgetProps {
  className?: string
  placeholder?: string
  showPopular?: boolean
  maxResults?: number
}

// Mock search data - in a real app, this would come from your CMS or search API
const searchData: SearchResult[] = [
  {
    id: '1',
    title: 'Quick Start Guide',
    description: 'Get up and running with ColdCopy in under 15 minutes',
    category: 'Getting Started',
    url: '/help/getting-started',
    readTime: '5 min read',
    popular: true,
    keywords: ['setup', 'start', 'begin', 'first', 'initial', 'quick', 'guide']
  },
  {
    id: '2',
    title: 'Setting Up Your Email Account',
    description: 'Connect Gmail, Outlook, or SMTP for sending campaigns',
    category: 'Email Setup',
    url: '/help/email-setup',
    readTime: '4 min read',
    popular: true,
    keywords: ['email', 'gmail', 'outlook', 'smtp', 'connect', 'setup', 'configuration']
  },
  {
    id: '3',
    title: 'Importing Leads from CSV',
    description: 'Upload and organize your prospect lists',
    category: 'Lead Management',
    url: '/help/lead-import',
    readTime: '3 min read',
    keywords: ['csv', 'import', 'leads', 'upload', 'prospects', 'contacts']
  },
  {
    id: '4',
    title: 'Writing High-Converting Subject Lines',
    description: 'Craft subject lines that boost open rates',
    category: 'Email Best Practices',
    url: '/help/subject-lines',
    readTime: '6 min read',
    popular: true,
    keywords: ['subject', 'lines', 'open', 'rate', 'conversion', 'writing', 'email']
  },
  {
    id: '5',
    title: 'Using AI Email Generation',
    description: 'Leverage AI to create personalized email content',
    category: 'AI Features',
    url: '/help/ai-generation',
    readTime: '7 min read',
    popular: true,
    keywords: ['ai', 'artificial', 'intelligence', 'generation', 'personalization', 'content']
  },
  {
    id: '6',
    title: 'Understanding Email Analytics',
    description: 'Track opens, clicks, replies, and campaign performance',
    category: 'Analytics',
    url: '/help/analytics',
    readTime: '8 min read',
    keywords: ['analytics', 'metrics', 'tracking', 'opens', 'clicks', 'replies', 'performance']
  },
  {
    id: '7',
    title: 'Campaign Best Practices',
    description: 'Proven strategies for successful cold email campaigns',
    category: 'Best Practices',
    url: '/help/best-practices',
    readTime: '12 min read',
    popular: true,
    keywords: ['best', 'practices', 'campaign', 'strategy', 'cold', 'email', 'success']
  },
  {
    id: '8',
    title: 'Email Deliverability Guide',
    description: 'Ensure your emails reach the inbox, not spam',
    category: 'Deliverability',
    url: '/help/deliverability',
    readTime: '15 min read',
    popular: true,
    keywords: ['deliverability', 'spam', 'inbox', 'reputation', 'dns', 'authentication']
  },
  {
    id: '9',
    title: 'Team Collaboration Features',
    description: 'Work with your team on campaigns and lead management',
    category: 'Team Features',
    url: '/help/team-features',
    readTime: '6 min read',
    keywords: ['team', 'collaboration', 'sharing', 'permissions', 'workspace']
  },
  {
    id: '10',
    title: 'API Documentation',
    description: 'Integrate ColdCopy with your existing tools and workflows',
    category: 'Integrations',
    url: '/help/api',
    readTime: '20 min read',
    keywords: ['api', 'integration', 'webhook', 'development', 'automation']
  }
]

const popularQueries = [
  'How to set up email',
  'Import CSV leads',
  'Improve open rates',
  'AI email generation',
  'Campaign best practices'
]

export function SearchWidget({ 
  className = '', 
  placeholder = 'Search help articles...',
  showPopular = true,
  maxResults = 5 
}: SearchWidgetProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // Filter search results based on query
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return showPopular ? searchData.filter(item => item.popular).slice(0, maxResults) : []
    }

    const normalizedQuery = query.toLowerCase().trim()
    const results = searchData.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(normalizedQuery)
      const descriptionMatch = item.description.toLowerCase().includes(normalizedQuery)
      const categoryMatch = item.category.toLowerCase().includes(normalizedQuery)
      const keywordMatch = item.keywords.some(keyword => 
        keyword.toLowerCase().includes(normalizedQuery) ||
        normalizedQuery.includes(keyword.toLowerCase())
      )
      
      return titleMatch || descriptionMatch || categoryMatch || keywordMatch
    })

    // Sort by relevance (exact matches first)
    return results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(normalizedQuery) || 
                    a.keywords.some(k => k.toLowerCase() === normalizedQuery)
      const bExact = b.title.toLowerCase().includes(normalizedQuery) ||
                    b.keywords.some(k => k.toLowerCase() === normalizedQuery)
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      
      // Secondary sort by popularity
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1
      
      return 0
    }).slice(0, maxResults)
  }, [query, showPopular, maxResults])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && searchResults[selectedIndex]) {
            window.location.href = searchResults[selectedIndex].url
          }
          break
        case 'Escape':
          setIsOpen(false)
          setSelectedIndex(-1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, searchResults])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchResults])

  const handlePopularQuery = (popularQuery: string) => {
    setQuery(popularQuery)
    setIsOpen(true)
  }

  const handleClear = () => {
    setQuery('')
    setSelectedIndex(-1)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto shadow-lg">
          <CardContent className="p-0">
            {/* Popular Queries (when no search query) */}
            {!query.trim() && showPopular && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Popular searches
                </h4>
                <div className="flex flex-wrap gap-2">
                  {popularQueries.map((popularQuery, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePopularQuery(popularQuery)}
                      className="text-xs"
                    >
                      {popularQuery}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="py-2">
                {!query.trim() && showPopular && (
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground border-b">
                    Popular articles
                  </div>
                )}
                {query.trim() && (
                  <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{query}"
                  </div>
                )}
                
                {searchResults.map((result, index) => (
                  <Link key={result.id} href={result.url}>
                    <div
                      className={`px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                        index === selectedIndex ? 'bg-muted/50' : ''
                      }`}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h4 className="font-medium text-sm truncate">
                              {result.title}
                            </h4>
                            {result.popular && (
                              <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {result.description}
                          </p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="text-xs">
                              {result.category}
                            </Badge>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{result.readTime}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="p-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-medium text-sm mb-2">No results found</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Try searching for something else or browse our help categories
                </p>
                <Link href="/help/contact">
                  <Button variant="outline" size="sm">
                    Contact Support
                  </Button>
                </Link>
              </div>
            ) : null}

            {/* Footer */}
            {(searchResults.length > 0 || query.trim()) && (
              <div className="border-t px-4 py-3 text-center">
                <Link href="/help">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Browse all help articles
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}