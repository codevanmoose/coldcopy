import {
  PipedriveApiError,
  PipedriveRateLimitError,
  PipedriveTokenBudgetError,
  PipedriveAuthError,
  PipedriveNetworkError,
  PipedriveRateLimitInfo,
  TokenBudgetInfo,
  PipedriveApiResponse,
  PipedriveSearchRequest,
  PipedriveSearchResponse,
  PipedriveBatchOperation,
} from './types';

interface RequestOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  workspaceId?: string;
  skipRateLimit?: boolean;
}

interface TokenCosts {
  [endpoint: string]: number;
}

// Token costs per endpoint (based on Pipedrive documentation)
const TOKEN_COSTS: TokenCosts = {
  'GET /persons': 1,
  'POST /persons': 2,
  'PUT /persons': 2,
  'DELETE /persons': 2,
  'GET /organizations': 1,
  'POST /organizations': 2,
  'PUT /organizations': 2,
  'DELETE /organizations': 2,
  'GET /deals': 1,
  'POST /deals': 3,
  'PUT /deals': 3,
  'DELETE /deals': 3,
  'GET /activities': 1,
  'POST /activities': 2,
  'PUT /activities': 2,
  'DELETE /activities': 2,
  'GET /pipelines': 1,
  'GET /stages': 1,
  'GET /itemSearch': 5, // Search endpoints cost more
  'POST /webhooks': 2,
  'GET /webhooks': 1,
  'DELETE /webhooks': 2,
};

class TokenBudgetManager {
  private static instance: TokenBudgetManager;
  private dailyUsage: Map<string, number> = new Map();
  private lastReset: Map<string, Date> = new Map();

  static getInstance(): TokenBudgetManager {
    if (!TokenBudgetManager.instance) {
      TokenBudgetManager.instance = new TokenBudgetManager();
    }
    return TokenBudgetManager.instance;
  }

  async getDailyLimit(workspaceId: string): Promise<number> {
    // Base limit is 30,000 per day
    // This should be fetched from workspace settings based on plan
    return 30000; // Placeholder - implement based on subscription plan
  }

  async getDailyUsage(workspaceId: string): Promise<number> {
    const today = new Date().toDateString();
    const key = `${workspaceId}:${today}`;
    
    const lastReset = this.lastReset.get(workspaceId);
    const currentDate = new Date();
    
    // Reset usage if it's a new day
    if (!lastReset || lastReset.toDateString() !== currentDate.toDateString()) {
      this.dailyUsage.set(key, 0);
      this.lastReset.set(workspaceId, currentDate);
    }
    
    return this.dailyUsage.get(key) || 0;
  }

  async consumeTokens(workspaceId: string, cost: number): Promise<void> {
    const today = new Date().toDateString();
    const key = `${workspaceId}:${today}`;
    const currentUsage = await this.getDailyUsage(workspaceId);
    
    this.dailyUsage.set(key, currentUsage + cost);
  }

  async checkTokenAvailability(workspaceId: string, cost: number): Promise<boolean> {
    const dailyLimit = await this.getDailyLimit(workspaceId);
    const currentUsage = await this.getDailyUsage(workspaceId);
    
    return currentUsage + cost <= dailyLimit;
  }

  async getTokenBudgetInfo(workspaceId: string): Promise<TokenBudgetInfo> {
    const dailyLimit = await this.getDailyLimit(workspaceId);
    const currentUsage = await this.getDailyUsage(workspaceId);
    
    // Calculate reset time (next midnight)
    const resetTime = new Date();
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);
    
    return {
      dailyBudget: dailyLimit,
      currentUsage,
      resetTime,
      remainingTokens: Math.max(0, dailyLimit - currentUsage),
    };
  }
}

class PipedriveRateLimiter {
  private tokenBucket: Map<string, number> = new Map();
  private lastRefill: Map<string, number> = new Map();
  private rateLimitInfo: Map<string, PipedriveRateLimitInfo> = new Map();

  async checkLimit(workspaceId: string, cost: number = 1): Promise<boolean> {
    const now = Date.now();
    const key = `pipedrive:${workspaceId}`;
    
    // Burst limit: 100 requests per 2 seconds
    const burstLimit = 100;
    const windowMs = 2000;
    
    // Daily limit check
    const tokenBudgetManager = TokenBudgetManager.getInstance();
    const canConsume = await tokenBudgetManager.checkTokenAvailability(workspaceId, cost);
    
    if (!canConsume) {
      const budgetInfo = await tokenBudgetManager.getTokenBudgetInfo(workspaceId);
      throw new PipedriveTokenBudgetError(budgetInfo.remainingTokens, budgetInfo.resetTime);
    }
    
    // Burst limit check
    const current = this.tokenBucket.get(key) || burstLimit;
    const lastRefill = this.lastRefill.get(key) || now;
    
    // Refill bucket based on time elapsed
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor(timePassed / windowMs) * burstLimit;
    const newTokens = Math.min(burstLimit, current + tokensToAdd);
    
    if (newTokens < cost) {
      const waitTime = Math.ceil((cost - newTokens) * windowMs / burstLimit);
      throw new PipedriveRateLimitError(Math.ceil(waitTime / 1000));
    }
    
    this.tokenBucket.set(key, newTokens - cost);
    this.lastRefill.set(key, now);
    
    // Consume tokens from daily budget
    await tokenBudgetManager.consumeTokens(workspaceId, cost);
    
    return true;
  }

  updateRateLimitInfo(workspaceId: string, headers: Headers): void {
    const key = `pipedrive:${workspaceId}`;
    
    // Pipedrive may not provide rate limit headers, so we estimate
    const remaining = parseInt(headers.get('X-RateLimit-Remaining') || '100');
    const limit = parseInt(headers.get('X-RateLimit-Limit') || '100');
    const reset = parseInt(headers.get('X-RateLimit-Reset') || String(Date.now() + 10000));
    
    this.rateLimitInfo.set(key, {
      remaining,
      limit,
      reset,
      burstRemaining: this.tokenBucket.get(key) || 100,
      burstLimit: 100,
    });
  }

  getRateLimitInfo(workspaceId: string): PipedriveRateLimitInfo | null {
    const key = `pipedrive:${workspaceId}`;
    return this.rateLimitInfo.get(key) || null;
  }
}

export class PipedriveClient {
  private baseUrl: string;
  private accessToken: string;
  private rateLimiter: PipedriveRateLimiter;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(accessToken: string, companyDomain?: string) {
    this.baseUrl = companyDomain 
      ? `https://${companyDomain}.pipedrive.com/api/v1`
      : 'https://api.pipedrive.com/v1';
    this.accessToken = accessToken;
    this.rateLimiter = new PipedriveRateLimiter();
  }

  /**
   * Calculate token cost for a request
   */
  private getTokenCost(method: string, endpoint: string): number {
    const key = `${method.toUpperCase()} ${endpoint.split('?')[0]}`;
    
    // Check for exact match first
    if (TOKEN_COSTS[key]) {
      return TOKEN_COSTS[key];
    }
    
    // Check for pattern matches
    for (const [pattern, cost] of Object.entries(TOKEN_COSTS)) {
      if (key.includes(pattern.split(' ')[1])) {
        return cost;
      }
    }
    
    // Default cost
    return method.toUpperCase() === 'GET' ? 1 : 2;
  }

  /**
   * Make an authenticated request to Pipedrive API
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<PipedriveApiResponse<T>> {
    const { 
      retries = 3, 
      retryDelay = 1000, 
      workspaceId, 
      skipRateLimit = false,
      ...fetchOptions 
    } = options;

    const method = fetchOptions.method || 'GET';
    const tokenCost = this.getTokenCost(method, endpoint);

    // Check rate limit and token budget
    if (!skipRateLimit && workspaceId) {
      try {
        await this.rateLimiter.checkLimit(workspaceId, tokenCost);
      } catch (error) {
        if (error instanceof PipedriveTokenBudgetError || error instanceof PipedriveRateLimitError) {
          throw error;
        }
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ColdCopy-Integration/1.0',
      ...fetchOptions.headers,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
        });

        // Update rate limit info from headers
        if (workspaceId) {
          this.rateLimiter.updateRateLimitInfo(workspaceId, response.headers);
        }

        // Handle rate limit errors
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('Retry-After') || '60'
          );
          throw new PipedriveRateLimitError(retryAfter);
        }

        // Handle auth errors
        if (response.status === 401) {
          throw new PipedriveAuthError('Invalid or expired access token');
        }

        // Handle other client errors
        if (response.status >= 400 && response.status < 500) {
          const error = await response.json().catch(() => ({ error: 'Client error' }));
          const apiError: PipedriveApiError = {
            error: error.error || 'Client error',
            error_info: error.error_info,
            data: error.data,
            additional_data: error.additional_data,
          };
          throw new Error(JSON.stringify(apiError));
        }

        // Handle server errors
        if (response.status >= 500) {
          throw new PipedriveNetworkError(
            `Server error: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        // Handle successful response
        if (!response.ok) {
          throw new PipedriveNetworkError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        const data = await response.json();
        
        // Pipedrive API always returns success field
        if (data.success === false) {
          const apiError: PipedriveApiError = {
            error: data.error || 'API request failed',
            error_info: data.error_info,
            data: data.data,
            additional_data: data.additional_data,
          };
          throw new Error(JSON.stringify(apiError));
        }

        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry auth errors or client errors
        if (error instanceof PipedriveAuthError || 
            (error instanceof Error && error.message.includes('Client error'))) {
          throw error;
        }

        // Handle rate limit errors
        if (error instanceof PipedriveRateLimitError) {
          if (attempt < retries) {
            await this.delay(error.retryAfter * 1000);
            continue;
          }
        }

        // Handle token budget errors (don't retry)
        if (error instanceof PipedriveTokenBudgetError) {
          throw error;
        }

        // Retry on network errors or 5xx errors
        if (attempt < retries && 
            (error instanceof PipedriveNetworkError || 
             error instanceof TypeError)) { // TypeError for network issues
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          await this.delay(delay);
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Queue a request to respect rate limits
   */
  async queueRequest<T = any>(
    fn: () => Promise<T>,
    workspaceId?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessingQueue) {
        this.processQueue(workspaceId);
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(workspaceId?: string) {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check if we can make requests (rate limit and token budget)
      if (workspaceId) {
        try {
          await this.rateLimiter.checkLimit(workspaceId, 1);
        } catch (error) {
          if (error instanceof PipedriveRateLimitError) {
            await this.delay(error.retryAfter * 1000);
            continue;
          } else if (error instanceof PipedriveTokenBudgetError) {
            // Stop processing queue if token budget exceeded
            break;
          }
        }
      }

      const request = this.requestQueue.shift();
      if (request) {
        await request();
        
        // Small delay between requests to avoid hitting rate limits
        await this.delay(100);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for common HTTP verbs

  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<PipedriveApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<PipedriveApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<PipedriveApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<PipedriveApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<PipedriveApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  // Pipedrive-specific methods

  async search<T = any>(
    searchRequest: PipedriveSearchRequest,
    options?: RequestOptions
  ): Promise<PipedriveSearchResponse<T>> {
    const params = new URLSearchParams();
    
    params.append('term', searchRequest.term);
    if (searchRequest.fields) params.append('fields', searchRequest.fields);
    if (searchRequest.exact !== undefined) params.append('exact', searchRequest.exact.toString());
    if (searchRequest.person_id) params.append('person_id', searchRequest.person_id.toString());
    if (searchRequest.organization_id) params.append('organization_id', searchRequest.organization_id.toString());
    if (searchRequest.deal_id) params.append('deal_id', searchRequest.deal_id.toString());
    if (searchRequest.include_fields) params.append('include_fields', searchRequest.include_fields);
    if (searchRequest.start !== undefined) params.append('start', searchRequest.start.toString());
    if (searchRequest.limit !== undefined) params.append('limit', searchRequest.limit.toString());

    return this.get<PipedriveSearchResponse<T>>(`/itemSearch?${params.toString()}`, options);
  }

  async batch<T = any>(
    endpoint: string,
    inputs: any[],
    batchSize = 100,
    options?: RequestOptions
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      
      // Process batch items individually since Pipedrive doesn't have a native batch API
      const batchPromises = batch.map(input => 
        this.post<T>(endpoint, input, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push(result.value.data);
        }
      }
    }

    return results;
  }

  /**
   * Get rate limit and token budget information
   */
  async getUsageInfo(workspaceId: string): Promise<{
    rateLimitInfo: PipedriveRateLimitInfo | null;
    tokenBudgetInfo: TokenBudgetInfo;
  }> {
    const tokenBudgetManager = TokenBudgetManager.getInstance();
    
    return {
      rateLimitInfo: this.rateLimiter.getRateLimitInfo(workspaceId),
      tokenBudgetInfo: await tokenBudgetManager.getTokenBudgetInfo(workspaceId),
    };
  }
}