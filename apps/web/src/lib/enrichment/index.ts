// Export all types and classes from the main service
export * from './enrichment-service'

// Export provider implementations
export * from './providers'

// Re-export the singleton instance for convenience
export { enrichmentService } from './enrichment-service'