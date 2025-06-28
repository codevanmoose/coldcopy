import { NextRequest, NextResponse } from 'next/server'

interface HelpArticle {
  id: string
  title: string
  description: string
  content: string
  category: string
  subcategory?: string
  url: string
  readTime: string
  popular: boolean
  featured: boolean
  keywords: string[]
  lastUpdated: string
  author: string
  views: number
}

// In a real application, this would come from a database or CMS
const helpArticles: HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Complete Setup Guide',
    description: 'Get up and running with ColdCopy in under 15 minutes',
    content: 'Detailed setup instructions...',
    category: 'Getting Started',
    url: '/help/getting-started',
    readTime: '5 min read',
    popular: true,
    featured: true,
    keywords: ['setup', 'start', 'begin', 'first', 'initial', 'quick', 'guide', 'onboarding'],
    lastUpdated: '2024-01-15',
    author: 'ColdCopy Team',
    views: 18600
  },
  {
    id: 'email-setup',
    title: 'Setting Up Your Email Account',
    description: 'Connect Gmail, Outlook, or SMTP for sending campaigns',
    content: 'Email setup instructions...',
    category: 'Email Setup',
    url: '/help/email-setup',
    readTime: '4 min read',
    popular: true,
    featured: false,
    keywords: ['email', 'gmail', 'outlook', 'smtp', 'connect', 'setup', 'configuration', 'auth'],
    lastUpdated: '2024-01-12',
    author: 'Sarah Chen',
    views: 15200
  },
  {
    id: 'lead-import',
    title: 'Importing Leads from CSV',
    description: 'Upload and organize your prospect lists',
    content: 'CSV import guide...',
    category: 'Lead Management',
    subcategory: 'Import & Export',
    url: '/help/lead-import',
    readTime: '3 min read',
    popular: false,
    featured: false,
    keywords: ['csv', 'import', 'leads', 'upload', 'prospects', 'contacts', 'data'],
    lastUpdated: '2024-01-10',
    author: 'Mike Rodriguez',
    views: 12800
  },
  {
    id: 'subject-lines',
    title: 'Writing High-Converting Subject Lines',
    description: 'Craft subject lines that boost open rates',
    content: 'Subject line best practices...',
    category: 'Best Practices',
    subcategory: 'Email Content',
    url: '/help/subject-lines',
    readTime: '6 min read',
    popular: true,
    featured: true,
    keywords: ['subject', 'lines', 'open', 'rate', 'conversion', 'writing', 'email', 'headlines'],
    lastUpdated: '2024-01-18',
    author: 'Emma Wilson',
    views: 14300
  },
  {
    id: 'ai-generation',
    title: 'Using AI Email Generation',
    description: 'Leverage AI to create personalized email content',
    content: 'AI generation guide...',
    category: 'AI Features',
    url: '/help/ai-generation',
    readTime: '7 min read',
    popular: true,
    featured: true,
    keywords: ['ai', 'artificial', 'intelligence', 'generation', 'personalization', 'content', 'gpt', 'automation'],
    lastUpdated: '2024-01-20',
    author: 'ColdCopy Team',
    views: 16700
  },
  {
    id: 'analytics',
    title: 'Understanding Email Analytics',
    description: 'Track opens, clicks, replies, and campaign performance',
    content: 'Analytics guide...',
    category: 'Analytics',
    url: '/help/analytics',
    readTime: '8 min read',
    popular: false,
    featured: false,
    keywords: ['analytics', 'metrics', 'tracking', 'opens', 'clicks', 'replies', 'performance', 'data'],
    lastUpdated: '2024-01-08',
    author: 'Sarah Chen',
    views: 9800
  },
  {
    id: 'best-practices',
    title: 'Cold Email Best Practices',
    description: 'Proven strategies for successful cold email campaigns',
    content: 'Comprehensive best practices...',
    category: 'Best Practices',
    url: '/help/best-practices',
    readTime: '12 min read',
    popular: true,
    featured: true,
    keywords: ['best', 'practices', 'campaign', 'strategy', 'cold', 'email', 'success', 'tips'],
    lastUpdated: '2024-01-22',
    author: 'ColdCopy Team',
    views: 22100
  },
  {
    id: 'deliverability',
    title: 'Email Deliverability Guide',
    description: 'Ensure your emails reach the inbox, not spam',
    content: 'Deliverability optimization...',
    category: 'Deliverability',
    url: '/help/deliverability',
    readTime: '15 min read',
    popular: true,
    featured: true,
    keywords: ['deliverability', 'spam', 'inbox', 'reputation', 'dns', 'authentication', 'dkim', 'spf'],
    lastUpdated: '2024-01-25',
    author: 'Emma Wilson',
    views: 19400
  },
  {
    id: 'team-features',
    title: 'Team Collaboration Features',
    description: 'Work with your team on campaigns and lead management',
    content: 'Team features overview...',
    category: 'Team Features',
    url: '/help/team-features',
    readTime: '6 min read',
    popular: false,
    featured: false,
    keywords: ['team', 'collaboration', 'sharing', 'permissions', 'workspace', 'roles'],
    lastUpdated: '2024-01-14',
    author: 'Mike Rodriguez',
    views: 7600
  },
  {
    id: 'api-docs',
    title: 'API Documentation',
    description: 'Integrate ColdCopy with your existing tools and workflows',
    content: 'Complete API documentation...',
    category: 'Integrations',
    subcategory: 'API',
    url: '/help/api',
    readTime: '20 min read',
    popular: false,
    featured: false,
    keywords: ['api', 'integration', 'webhook', 'development', 'automation', 'rest', 'endpoints'],
    lastUpdated: '2024-01-30',
    author: 'ColdCopy Team',
    views: 5200
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''
    const category = searchParams.get('category')?.toLowerCase()
    const popular = searchParams.get('popular') === 'true'
    const featured = searchParams.get('featured') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10')

    let results = helpArticles

    // Filter by category
    if (category) {
      results = results.filter(article => 
        article.category.toLowerCase().includes(category) ||
        article.subcategory?.toLowerCase().includes(category)
      )
    }

    // Filter by popular
    if (popular) {
      results = results.filter(article => article.popular)
    }

    // Filter by featured
    if (featured) {
      results = results.filter(article => article.featured)
    }

    // Search filter
    if (query) {
      results = results.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(query)
        const descriptionMatch = article.description.toLowerCase().includes(query)
        const categoryMatch = article.category.toLowerCase().includes(query)
        const subcategoryMatch = article.subcategory?.toLowerCase().includes(query)
        const keywordMatch = article.keywords.some(keyword => 
          keyword.toLowerCase().includes(query) ||
          query.includes(keyword.toLowerCase())
        )
        
        return titleMatch || descriptionMatch || categoryMatch || subcategoryMatch || keywordMatch
      })

      // Sort by relevance for search queries
      results.sort((a, b) => {
        // Exact title matches first
        const aExactTitle = a.title.toLowerCase().includes(query)
        const bExactTitle = b.title.toLowerCase().includes(query)
        if (aExactTitle && !bExactTitle) return -1
        if (!aExactTitle && bExactTitle) return 1

        // Exact keyword matches second
        const aExactKeyword = a.keywords.some(k => k.toLowerCase() === query)
        const bExactKeyword = b.keywords.some(k => k.toLowerCase() === query)
        if (aExactKeyword && !bExactKeyword) return -1
        if (!aExactKeyword && bExactKeyword) return 1

        // Popular articles third
        if (a.popular && !b.popular) return -1
        if (!a.popular && b.popular) return 1

        // Views as tiebreaker
        return b.views - a.views
      })
    } else {
      // Default sort by views when no search query
      results.sort((a, b) => {
        // Featured articles first
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        
        // Popular articles second
        if (a.popular && !b.popular) return -1
        if (!a.popular && b.popular) return 1
        
        // Views as tiebreaker
        return b.views - a.views
      })
    }

    // Apply limit
    results = results.slice(0, limit)

    // Return results with metadata
    return NextResponse.json({
      results,
      total: results.length,
      query,
      filters: {
        category,
        popular,
        featured
      }
    })
  } catch (error) {
    console.error('Help search error:', error)
    return NextResponse.json(
      { error: 'Failed to search help articles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint could be used to track search queries and article views
    const { query, articleId, action } = await request.json()

    // In a real application, you would:
    // 1. Log the search query for analytics
    // 2. Track article views
    // 3. Store user interaction data
    // 4. Update search suggestions based on popular queries

    if (action === 'view' && articleId) {
      // Increment view count for the article
      const article = helpArticles.find(a => a.id === articleId)
      if (article) {
        article.views += 1
      }
    }

    if (action === 'search' && query) {
      // Log search query for analytics
      console.log(`Search query: "${query}"`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Help search tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track search interaction' },
      { status: 500 }
    )
  }
}