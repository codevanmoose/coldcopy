export * from './hunter-provider'
export * from './clearbit-provider'

// Export a factory function to create providers
import { EnrichmentProvider, EnrichmentProviderAdapter } from '../enrichment-service'
import { HunterProvider } from './hunter-provider'
import { ClearbitProvider } from './clearbit-provider'

export function createProviderAdapter(
  provider: EnrichmentProvider,
  apiKey: string
): EnrichmentProviderAdapter | null {
  switch (provider.name.toLowerCase()) {
    case 'hunter.io':
    case 'hunter':
      return new HunterProvider(provider, apiKey)
    
    case 'clearbit':
      return new ClearbitProvider(provider, apiKey)
    
    // Add more providers here as they are implemented
    // case 'apollo':
    //   return new ApolloProvider(provider, apiKey)
    
    // case 'zoominfo':
    //   return new ZoomInfoProvider(provider, apiKey)
    
    default:
      console.warn(`No adapter implementation for provider: ${provider.name}`)
      return null
  }
}