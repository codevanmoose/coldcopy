import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// This configures a Service Worker with the given request handlers for the browser
export const worker = setupWorker(...handlers)