import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    
    // Integrations
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Filtering
    ignoreErrors: [
      // Browser extensions
      'Non-Error promise rejection captured',
      // Network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      // User-caused errors
      'ResizeObserver loop limit exceeded',
      // Known Next.js errors
      'NEXT_NOT_FOUND',
    ],
    
    beforeSend(event, hint) {
      // Filter out non-application errors
      if (event.exception) {
        const error = hint.originalException as Error
        
        // Filter out errors from browser extensions
        if (error && error.stack && error.stack.includes('extension://')) {
          return null
        }
        
        // Filter out network errors in development
        if (process.env.NODE_ENV === 'development' && 
            error && error.message && error.message.includes('fetch')) {
          return null
        }
      }
      
      return event
    },
  })
}