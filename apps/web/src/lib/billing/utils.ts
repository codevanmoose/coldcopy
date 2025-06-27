import { 
  Subscription, 
  SubscriptionPlan, 
  PaymentMethod, 
  Invoice, 
  UsageMetric,
  BillingInterval,
  Money,
  DateRange
} from './types'

/**
 * Currency formatting utilities
 */
export const Currency = {
  /**
   * Format amount as currency
   */
  format(amount: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  },

  /**
   * Format amount with explicit decimal places
   */
  formatPrecise(amount: number, currency = 'USD', decimals = 2, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
  },

  /**
   * Convert cents to dollars
   */
  fromCents(cents: number): number {
    return cents / 100
  },

  /**
   * Convert dollars to cents
   */
  toCents(dollars: number): number {
    return Math.round(dollars * 100)
  },

  /**
   * Format as compact currency (e.g., $1.2K)
   */
  formatCompact(amount: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumSignificantDigits: 3,
    }).format(amount)
  },
}

/**
 * Date and period utilities
 */
export const Period = {
  /**
   * Format billing period
   */
  format(start: Date, end: Date, locale = 'en-US'): string {
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${formatter.format(start)} - ${formatter.format(end)}`
  },

  /**
   * Get days remaining in period
   */
  getDaysRemaining(periodEnd: Date): number {
    const now = new Date()
    const diffTime = periodEnd.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  },

  /**
   * Get days in period
   */
  getDaysInPeriod(periodStart: Date, periodEnd: Date): number {
    const diffTime = periodEnd.getTime() - periodStart.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },

  /**
   * Get progress through period as percentage
   */
  getProgress(periodStart: Date, periodEnd: Date): number {
    const now = new Date()
    const total = periodEnd.getTime() - periodStart.getTime()
    const elapsed = now.getTime() - periodStart.getTime()
    const progress = (elapsed / total) * 100
    return Math.max(0, Math.min(100, progress))
  },

  /**
   * Get next billing date
   */
  getNextBillingDate(currentPeriodEnd: Date | null): Date | null {
    if (!currentPeriodEnd) return null
    return new Date(currentPeriodEnd)
  },

  /**
   * Check if date is in current period
   */
  isInCurrentPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
    return date >= periodStart && date <= periodEnd
  },
}

/**
 * Subscription utilities
 */
export const SubscriptionUtils = {
  /**
   * Check if subscription is active
   */
  isActive(subscription: Subscription): boolean {
    return ['active', 'trialing'].includes(subscription.status)
  },

  /**
   * Check if subscription is in trial
   */
  isInTrial(subscription: Subscription): boolean {
    return (
      subscription.status === 'trialing' &&
      subscription.trialEnd !== null &&
      subscription.trialEnd > new Date()
    )
  },

  /**
   * Get trial days remaining
   */
  getTrialDaysRemaining(subscription: Subscription): number | null {
    if (!this.isInTrial(subscription) || !subscription.trialEnd) return null
    return Period.getDaysRemaining(subscription.trialEnd)
  },

  /**
   * Check if subscription will renew
   */
  willRenew(subscription: Subscription): boolean {
    return (
      this.isActive(subscription) &&
      !subscription.cancelAtPeriodEnd &&
      subscription.canceledAt === null
    )
  },

  /**
   * Get subscription interval
   */
  getInterval(subscription: Subscription, plan: SubscriptionPlan): BillingInterval {
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      return BillingInterval.MONTHLY
    }
    
    const days = Period.getDaysInPeriod(
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    )
    
    return days > 32 ? BillingInterval.YEARLY : BillingInterval.MONTHLY
  },

  /**
   * Calculate proration for plan change
   */
  calculateProration({
    currentPlan,
    newPlan,
    daysRemaining,
    daysInPeriod,
    isYearly = false,
  }: {
    currentPlan: SubscriptionPlan
    newPlan: SubscriptionPlan
    daysRemaining: number
    daysInPeriod: number
    isYearly?: boolean
  }): {
    credit: number
    charge: number
    total: number
  } {
    const currentPrice = isYearly ? currentPlan.priceYearly : currentPlan.priceMonthly
    const newPrice = isYearly ? newPlan.priceYearly : newPlan.priceMonthly
    
    const dailyCurrentPrice = currentPrice / daysInPeriod
    const dailyNewPrice = newPrice / daysInPeriod
    
    const credit = dailyCurrentPrice * daysRemaining
    const charge = dailyNewPrice * daysRemaining
    const total = charge - credit
    
    return {
      credit: Math.round(credit * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      total: Math.round(total * 100) / 100,
    }
  },
}

/**
 * Payment method utilities
 */
export const PaymentMethodUtils = {
  /**
   * Check if payment method is expired
   */
  isExpired(paymentMethod: PaymentMethod): boolean {
    if (!paymentMethod.expMonth || !paymentMethod.expYear) return false
    
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    return (
      paymentMethod.expYear < currentYear ||
      (paymentMethod.expYear === currentYear && paymentMethod.expMonth < currentMonth)
    )
  },

  /**
   * Check if payment method is expiring soon
   */
  isExpiringSoon(paymentMethod: PaymentMethod, monthsAhead = 2): boolean {
    if (!paymentMethod.expMonth || !paymentMethod.expYear) return false
    
    const now = new Date()
    const expiryDate = new Date(paymentMethod.expYear, paymentMethod.expMonth - 1)
    const warningDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead)
    
    return expiryDate <= warningDate
  },

  /**
   * Format card display
   */
  formatCard(paymentMethod: PaymentMethod): string {
    if (paymentMethod.type !== 'card' || !paymentMethod.brand || !paymentMethod.last4) {
      return 'Payment method'
    }
    
    const brand = paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
    return `${brand} •••• ${paymentMethod.last4}`
  },

  /**
   * Format expiry date
   */
  formatExpiry(paymentMethod: PaymentMethod): string {
    if (!paymentMethod.expMonth || !paymentMethod.expYear) return ''
    
    const month = paymentMethod.expMonth.toString().padStart(2, '0')
    const year = paymentMethod.expYear.toString().slice(-2)
    return `${month}/${year}`
  },

  /**
   * Get card brand icon
   */
  getCardIcon(brand: string | null): string {
    const icons: Record<string, string> = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳',
      diners: '💳',
      jcb: '💳',
      unionpay: '💳',
    }
    return icons[brand?.toLowerCase() || ''] || '💳'
  },
}

/**
 * Usage utilities
 */
export const UsageUtils = {
  /**
   * Format usage with appropriate units
   */
  format(metric: UsageMetric, quantity: number, includeUnit = true): string {
    const units: Record<UsageMetric, string> = {
      [UsageMetric.EMAILS_SENT]: 'emails',
      [UsageMetric.LEADS_ENRICHED]: 'leads',
      [UsageMetric.AI_TOKENS]: 'tokens',
    }

    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(quantity)

    if (includeUnit) {
      return `${formatted} ${units[metric]}`
    }

    return formatted
  },

  /**
   * Format usage as compact (e.g., 1.2K)
   */
  formatCompact(quantity: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumSignificantDigits: 3,
    }).format(quantity)
  },

  /**
   * Calculate usage percentage
   */
  getPercentage(used: number, limit: number | null): number | null {
    if (!limit || limit === 0) return null
    return Math.min(100, Math.round((used / limit) * 100))
  },

  /**
   * Get usage status based on percentage
   */
  getStatus(percentage: number | null): 'low' | 'medium' | 'high' | 'exceeded' | null {
    if (percentage === null) return null
    if (percentage >= 100) return 'exceeded'
    if (percentage >= 90) return 'high'
    if (percentage >= 70) return 'medium'
    return 'low'
  },

  /**
   * Get usage color based on percentage
   */
  getColor(percentage: number | null): string {
    if (percentage === null) return 'gray'
    if (percentage >= 100) return 'red'
    if (percentage >= 90) return 'orange'
    if (percentage >= 70) return 'yellow'
    return 'green'
  },

  /**
   * Project usage for end of period
   */
  projectUsage(
    currentUsage: number,
    periodStart: Date,
    periodEnd: Date
  ): number {
    const now = new Date()
    const totalDays = Period.getDaysInPeriod(periodStart, periodEnd)
    const elapsedDays = Period.getDaysInPeriod(periodStart, now)
    
    if (elapsedDays === 0) return 0
    
    const dailyRate = currentUsage / elapsedDays
    return Math.round(dailyRate * totalDays)
  },
}

/**
 * Invoice utilities
 */
export const InvoiceUtils = {
  /**
   * Check if invoice is overdue
   */
  isOverdue(invoice: Invoice): boolean {
    if (invoice.status === 'paid' || !invoice.dueDate) return false
    return new Date() > invoice.dueDate
  },

  /**
   * Get days until due
   */
  getDaysUntilDue(invoice: Invoice): number | null {
    if (!invoice.dueDate || invoice.status === 'paid') return null
    return Period.getDaysRemaining(invoice.dueDate)
  },

  /**
   * Format invoice number
   */
  formatNumber(invoice: Invoice): string {
    return invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`
  },

  /**
   * Calculate total from line items
   */
  calculateTotal(lineItems: Invoice['lineItems']): number {
    return lineItems.reduce((total, item) => total + item.amount, 0)
  },

  /**
   * Get invoice status color
   */
  getStatusColor(status: Invoice['status']): string {
    const colors: Record<Invoice['status'], string> = {
      draft: 'gray',
      open: 'blue',
      paid: 'green',
      void: 'gray',
      uncollectible: 'red',
    }
    return colors[status]
  },

  /**
   * Get invoice status label
   */
  getStatusLabel(status: Invoice['status']): string {
    const labels: Record<Invoice['status'], string> = {
      draft: 'Draft',
      open: 'Open',
      paid: 'Paid',
      void: 'Void',
      uncollectible: 'Uncollectible',
    }
    return labels[status]
  },
}

/**
 * Plan comparison utilities
 */
export const PlanUtils = {
  /**
   * Check if plan is free
   */
  isFree(plan: SubscriptionPlan): boolean {
    return plan.priceMonthly === 0 && plan.priceYearly === 0
  },

  /**
   * Get plan price for interval
   */
  getPrice(plan: SubscriptionPlan, interval: BillingInterval): number {
    return interval === BillingInterval.YEARLY ? plan.priceYearly : plan.priceMonthly
  },

  /**
   * Calculate savings for yearly billing
   */
  getYearlySavings(plan: SubscriptionPlan): number {
    const monthlyTotal = plan.priceMonthly * 12
    const yearlySavings = monthlyTotal - plan.priceYearly
    return Math.max(0, yearlySavings)
  },

  /**
   * Get savings percentage for yearly billing
   */
  getYearlySavingsPercentage(plan: SubscriptionPlan): number {
    if (plan.priceMonthly === 0) return 0
    const monthlyTotal = plan.priceMonthly * 12
    const savings = this.getYearlySavings(plan)
    return Math.round((savings / monthlyTotal) * 100)
  },

  /**
   * Compare plans
   */
  compare(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): 'upgrade' | 'downgrade' | 'same' {
    if (currentPlan.id === newPlan.id) return 'same'
    if (newPlan.priceMonthly > currentPlan.priceMonthly) return 'upgrade'
    return 'downgrade'
  },

  /**
   * Check if feature is available
   */
  hasFeature(plan: SubscriptionPlan, feature: string): boolean {
    return plan.features.includes(feature)
  },

  /**
   * Check if limit is exceeded
   */
  isLimitExceeded(plan: SubscriptionPlan, metric: UsageMetric, usage: number): boolean {
    const limit = plan.limits[metric]
    if (limit === null || limit === undefined) return false
    return usage > limit
  },
}

/**
 * Validation utilities
 */
export const Validation = {
  /**
   * Validate email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate credit card number (Luhn algorithm)
   */
  isValidCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) return false

    let sum = 0
    let isEven = false

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10)

      if (isEven) {
        digit *= 2
        if (digit > 9) {
          digit -= 9
        }
      }

      sum += digit
      isEven = !isEven
    }

    return sum % 10 === 0
  },

  /**
   * Validate CVV
   */
  isValidCVV(cvv: string, cardBrand?: string): boolean {
    const cvvDigits = cvv.replace(/\D/g, '')
    
    if (cardBrand?.toLowerCase() === 'amex') {
      return cvvDigits.length === 4
    }
    
    return cvvDigits.length === 3
  },

  /**
   * Validate expiry date
   */
  isValidExpiry(month: number, year: number): boolean {
    if (month < 1 || month > 12) return false
    
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    // Convert 2-digit year to 4-digit
    const fullYear = year < 100 ? 2000 + year : year
    
    if (fullYear < currentYear) return false
    if (fullYear === currentYear && month < currentMonth) return false
    
    return true
  },

  /**
   * Validate postal code
   */
  isValidPostalCode(postalCode: string, country = 'US'): boolean {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
      UK: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
      AU: /^\d{4}$/,
      DE: /^\d{5}$/,
      FR: /^\d{5}$/,
      IT: /^\d{5}$/,
      ES: /^\d{5}$/,
      NL: /^\d{4}\s?[A-Za-z]{2}$/,
      BE: /^\d{4}$/,
      AT: /^\d{4}$/,
      CH: /^\d{4}$/,
      JP: /^\d{3}-?\d{4}$/,
    }
    
    const pattern = patterns[country] || patterns.US
    return pattern.test(postalCode)
  },
}

/**
 * Analytics utilities
 */
export const Analytics = {
  /**
   * Calculate MRR (Monthly Recurring Revenue)
   */
  calculateMRR(subscriptions: Array<{ plan: SubscriptionPlan; interval: BillingInterval }>): number {
    return subscriptions.reduce((total, sub) => {
      const monthlyAmount = sub.interval === BillingInterval.YEARLY 
        ? sub.plan.priceYearly / 12 
        : sub.plan.priceMonthly
      return total + monthlyAmount
    }, 0)
  },

  /**
   * Calculate ARR (Annual Recurring Revenue)
   */
  calculateARR(mrr: number): number {
    return mrr * 12
  },

  /**
   * Calculate churn rate
   */
  calculateChurnRate(
    canceledCount: number,
    totalCount: number,
    periodDays = 30
  ): number {
    if (totalCount === 0) return 0
    const monthlyChurn = (canceledCount / totalCount) * (30 / periodDays)
    return Math.round(monthlyChurn * 10000) / 100 // Return as percentage
  },

  /**
   * Calculate retention rate
   */
  calculateRetentionRate(churnRate: number): number {
    return 100 - churnRate
  },

  /**
   * Calculate lifetime value
   */
  calculateLifetimeValue(averageRevenue: number, churnRate: number): number {
    if (churnRate === 0) return Infinity
    const monthlyChurnRate = churnRate / 100
    return averageRevenue / monthlyChurnRate
  },

  /**
   * Calculate growth rate
   */
  calculateGrowthRate(previousValue: number, currentValue: number): number {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0
    const growth = ((currentValue - previousValue) / previousValue) * 100
    return Math.round(growth * 100) / 100
  },
}

/**
 * Retry utility for handling transient failures
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    backoff?: number
    shouldRetry?: (error: any, attempt: number) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true,
  } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError
}

/**
 * Batch processing utility
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number
    onProgress?: (completed: number, total: number) => void
    onError?: (error: any, item: T, index: number) => void
  } = {}
): Promise<R[]> {
  const { batchSize = 10, onProgress, onError } = options
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchPromises = batch.map(async (item, index) => {
      try {
        return await processor(item)
      } catch (error) {
        if (onError) {
          onError(error, item, i + index)
        }
        throw error
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    if (onProgress) {
      onProgress(results.length, items.length)
    }
  }
  
  return results
}