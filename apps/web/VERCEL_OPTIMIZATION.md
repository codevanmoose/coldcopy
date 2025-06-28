# Vercel Build & Deploy Optimization Guide

## Phase 1.3: Build & Deploy Optimization

This guide covers configuring ISR (Incremental Static Regeneration), edge functions, and caching for optimal performance on Vercel.

## 1. Incremental Static Regeneration (ISR)

### Configure ISR for Dynamic Pages

ISR allows pages to be statically generated at build time and updated in the background.

#### Landing/Marketing Pages
```typescript
// app/(marketing)/page.tsx
export const revalidate = 3600 // Revalidate every hour

// app/(marketing)/pricing/page.tsx
export const revalidate = 86400 // Revalidate daily
```

#### Blog/Documentation Pages
```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 600 // Revalidate every 10 minutes

export async function generateStaticParams() {
  // Pre-build popular blog posts
  const posts = await getBlogPosts()
  return posts.slice(0, 10).map((post) => ({
    slug: post.slug,
  }))
}
```

#### Dashboard Pages (Dynamic)
```typescript
// app/(dashboard)/dashboard/page.tsx
export const dynamic = 'force-dynamic' // Always server-render
export const revalidate = 0 // No caching
```

## 2. Edge Runtime Configuration

### Convert Middleware to Edge Runtime

Our middleware is already using Edge Runtime for better performance:

```typescript
// middleware.ts
export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### API Routes on Edge Runtime

For lightweight API routes, use Edge Runtime:

```typescript
// app/api/health/route.ts
export const runtime = 'edge'

export async function GET() {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json' },
  })
}
```

## 3. Caching Strategy

### Static Assets
```typescript
// next.config.ts (already configured)
const nextConfig = {
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },
  // ... other config
}
```

### API Response Caching
```typescript
// app/api/public/features/route.ts
export async function GET() {
  const features = await getFeatures()
  
  return NextResponse.json(features, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
```

### CDN Cache Headers
```typescript
// app/api/blog/[slug]/route.ts
export async function GET(request: Request) {
  const post = await getBlogPost(slug)
  
  return NextResponse.json(post, {
    headers: {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'max-age=3600',
      'Vercel-CDN-Cache-Control': 'max-age=3600',
    },
  })
}
```

## 4. Image Optimization

### Configure Image Domains
Already configured in `next.config.ts`:
```typescript
images: {
  domains: [
    'ui-avatars.com',
    'lh3.googleusercontent.com',
    'avatars.githubusercontent.com',
    'pbs.twimg.com',
    'media.licdn.com',
  ],
  formats: ['image/avif', 'image/webp'],
}
```

### Use Next.js Image Component
```typescript
import Image from 'next/image'

<Image
  src={avatarUrl}
  alt="User avatar"
  width={40}
  height={40}
  loading="lazy"
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>
```

## 5. Bundle Optimization

### Configure SWC Minification
Already enabled in `next.config.ts`:
```typescript
swcMinify: true,
productionBrowserSourceMaps: false,
```

### Tree Shaking & Code Splitting
```typescript
// Use dynamic imports for heavy components
const HeavyChart = dynamic(() => import('@/components/analytics/heavy-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
})
```

### Optimize Package Imports
Already configured in `next.config.ts`:
```typescript
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'recharts'],
}
```

## 6. Function Configuration

### Set Function Timeouts
Update `vercel.json` for specific routes:
```json
{
  "functions": {
    "app/api/email/send/route.ts": {
      "maxDuration": 30
    },
    "app/api/leads/import/route.ts": {
      "maxDuration": 60
    },
    "app/api/enrichment/batch/route.ts": {
      "maxDuration": 60
    },
    "app/api/cron/*/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### Configure Memory Limits
```json
{
  "functions": {
    "app/api/analytics/export/route.ts": {
      "memory": 3008
    },
    "app/api/gdpr/export/route.ts": {
      "memory": 3008
    }
  }
}
```

## 7. Regional Edge Functions

### Configure Regional Deployment
```typescript
// app/api/email/track/[action]/[id]/route.ts
export const runtime = 'edge'
export const preferredRegion = ['iad1', 'sfo1'] // US East & West
```

## 8. Monitoring & Analytics

### Enable Vercel Analytics
```bash
npm i @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Enable Speed Insights
```bash
npm i @vercel/speed-insights
```

```typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

## 9. Build Optimization Commands

### Pre-deployment Build Check
```bash
# Run locally before deploying
npm run deploy:verify

# This runs:
# - env:verify (check environment variables)
# - build (Next.js production build)
# - typecheck (TypeScript validation)
# - lint (ESLint checks)
```

### Production Deployment
```bash
# Deploy to production
npm run deploy:production

# Or with Vercel CLI
vercel --prod
```

## 10. Vercel Project Settings

### Configure in Vercel Dashboard

1. **Build & Development Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Development Command: `npm run dev`

2. **Node.js Version**
   - Select: 20.x (latest LTS)

3. **Environment Variables**
   - Add all variables from VERCEL_ENV_CONFIG.md
   - Set appropriate environments (Production/Preview/Development)

4. **Functions**
   - Region: US East (Primary)
   - Include Files: `node_modules/**`

5. **Advanced**
   - Enable: "Include source files outside of the Root Directory"
   - Build Cache: Enabled

## 11. Performance Targets

After optimization, aim for:
- **Lighthouse Score**: 90+ across all metrics
- **First Contentful Paint**: < 1.2s
- **Time to Interactive**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **API Response Time**: < 200ms (p95)

## 12. Deployment Checklist

- [ ] All environment variables configured
- [ ] Build passes locally (`npm run build`)
- [ ] TypeScript checks pass (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] ISR configured for appropriate pages
- [ ] Edge functions configured where beneficial
- [ ] Cache headers set for public APIs
- [ ] Image optimization configured
- [ ] Bundle size optimized
- [ ] Function timeouts configured
- [ ] Analytics enabled
- [ ] Speed Insights enabled

## Next Steps

After completing optimization:
1. Deploy to production: `vercel --prod`
2. Monitor deployment in Vercel dashboard
3. Check all cron jobs are running
4. Verify custom domain is working
5. Run performance tests
6. Monitor error rates and performance metrics