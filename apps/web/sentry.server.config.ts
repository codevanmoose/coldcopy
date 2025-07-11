import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    
    // Server-specific options
    
    // Filtering
    ignoreErrors: [
      // Known errors
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],
    
    beforeSend(event, hint) {
      // Add additional context
      if (event.request) {
        // Remove sensitive data from requests
        if (event.request.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
        }
        
        if (event.request.data && typeof event.request.data === 'object') {
          // Remove sensitive fields
          const sensitiveFields = ['password', 'token', 'api_key', 'secret']
          const data = event.request.data as Record<string, any>
          sensitiveFields.forEach(field => {
            if (data[field]) {
              data[field] = '[REDACTED]'
            }
          })
        }
      }
      
      return event
    },
  })
}