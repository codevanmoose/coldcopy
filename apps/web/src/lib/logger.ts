type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  workspaceId?: string
  sessionId?: string
  [key: string]: any
}

class Logger {
  private context: LogContext = {}
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  // Set global context that will be included in all logs
  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
  }

  // Clear specific context keys
  clearContext(keys?: string[]) {
    if (keys) {
      keys.forEach(key => delete this.context[key])
    } else {
      this.context = {}
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      level,
      message,
      ...this.context,
      ...(data && { data }),
      environment: process.env.NODE_ENV,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    }

    return logData
  }

  private sendToService(logData: any) {
    if (!this.isProduction) return

    // In production, send logs to your logging service
    // This is a placeholder - replace with your actual logging service
    try {
      // Example: Send to an API endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      }).catch(() => {
        // Fail silently to not disrupt the app
      })
    } catch (error) {
      // Fail silently
    }
  }

  debug(message: string, data?: any) {
    if (this.isDevelopment) {
      const logData = this.formatMessage('debug', message, data)
      console.debug(`[DEBUG] ${message}`, data || '')
      this.sendToService(logData)
    }
  }

  info(message: string, data?: any) {
    const logData = this.formatMessage('info', message, data)
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, data || '')
    }
    this.sendToService(logData)
  }

  warn(message: string, data?: any) {
    const logData = this.formatMessage('warn', message, data)
    console.warn(`[WARN] ${message}`, data || '')
    this.sendToService(logData)
  }

  error(message: string, error?: Error | any, data?: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error

    const logData = this.formatMessage('error', message, {
      error: errorData,
      ...data,
    })

    console.error(`[ERROR] ${message}`, error || '')
    this.sendToService(logData)
  }

  // Track specific events
  track(eventName: string, properties?: any) {
    const logData = this.formatMessage('info', `Event: ${eventName}`, {
      event: eventName,
      properties,
    })

    if (this.isDevelopment) {
      console.info(`[EVENT] ${eventName}`, properties || '')
    }

    this.sendToService(logData)
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: any) {
    const logData = this.formatMessage('info', `Performance: ${operation}`, {
      operation,
      duration,
      metadata,
    })

    if (this.isDevelopment) {
      console.info(`[PERF] ${operation}: ${duration}ms`, metadata || '')
    }

    if (duration > 1000) {
      // Log slow operations as warnings
      this.warn(`Slow operation: ${operation}`, { duration, metadata })
    }

    this.sendToService(logData)
  }

  // Create a timer for performance measurements
  startTimer(operation: string): () => void {
    const start = performance.now()
    
    return (metadata?: any) => {
      const duration = Math.round(performance.now() - start)
      this.performance(operation, duration, metadata)
    }
  }
}

// Create singleton instance
export const logger = new Logger()

// Convenience functions
export const logDebug = (message: string, data?: any) => logger.debug(message, data)
export const logInfo = (message: string, data?: any) => logger.info(message, data)
export const logWarn = (message: string, data?: any) => logger.warn(message, data)
export const logError = (message: string, error?: Error | any, data?: any) => logger.error(message, error, data)
export const track = (eventName: string, properties?: any) => logger.track(eventName, properties)

// React hook for logging with component context
import { useEffect } from 'react'

export function useLogger(componentName: string) {
  useEffect(() => {
    logger.setContext({ component: componentName })
    
    return () => {
      logger.clearContext(['component'])
    }
  }, [componentName])

  return logger
}

// Error logging helper
export function logException(error: Error, context?: any) {
  logger.error('Unhandled exception', error, {
    context,
    errorBoundary: false,
  })
}

// API error logging helper
export function logApiError(endpoint: string, error: any, requestData?: any) {
  logger.error(`API Error: ${endpoint}`, error, {
    endpoint,
    requestData,
    statusCode: error?.status || error?.response?.status,
    responseData: error?.data || error?.response?.data,
  })
}