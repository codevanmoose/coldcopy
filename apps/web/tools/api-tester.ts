import { chromium, Browser, Page, BrowserContext, APIRequestContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface APITestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

interface APITestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  responseTime: number;
  data?: any;
  error?: string;
  headers?: Record<string, string>;
}

export class APITester {
  private config: APITestConfig;
  private context: APIRequestContext | null = null;
  private results: APITestResult[] = [];
  
  constructor(config: APITestConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    };
  }
  
  async initialize() {
    const browser = await chromium.launch();
    this.context = await browser.request.newContext({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      extraHTTPHeaders: this.config.headers
    });
  }
  
  async testEndpoint(
    endpoint: string, 
    method: string = 'GET', 
    options?: {
      data?: any;
      headers?: Record<string, string>;
      expectedStatus?: number;
    }
  ): Promise<APITestResult> {
    if (!this.context) throw new Error('API tester not initialized');
    
    const startTime = Date.now();
    const result: APITestResult = {
      endpoint,
      method,
      status: 0,
      success: false,
      responseTime: 0
    };
    
    try {
      const response = await this.context.fetch(endpoint, {
        method,
        data: options?.data,
        headers: options?.headers
      });
      
      result.status = response.status();
      result.responseTime = Date.now() - startTime;
      result.headers = response.headers();
      
      // Check if response is JSON
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          result.data = await response.json();
        } catch {
          result.data = await response.text();
        }
      } else {
        result.data = await response.text();
      }
      
      // Determine success
      const expectedStatus = options?.expectedStatus || 200;
      result.success = result.status === expectedStatus;
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.responseTime = Date.now() - startTime;
    }
    
    this.results.push(result);
    return result;
  }
  
  async testHealthEndpoints(): Promise<Record<string, APITestResult>> {
    const healthEndpoints = [
      '/api/health',
      '/api/test-ai-config',
      '/api/ses-status',
      '/api/auth/session'
    ];
    
    const results: Record<string, APITestResult> = {};
    
    for (const endpoint of healthEndpoints) {
      console.log(chalk.gray(`Testing ${endpoint}...`));
      results[endpoint] = await this.testEndpoint(endpoint);
    }
    
    return results;
  }
  
  async testAuthFlow(credentials: { email: string; password: string }): Promise<any> {
    console.log(chalk.blue('Testing authentication flow...'));
    
    // 1. Test login
    const loginResult = await this.testEndpoint('/api/auth/signin', 'POST', {
      data: {
        email: credentials.email,
        password: credentials.password
      },
      expectedStatus: 200
    });
    
    // 2. Test session
    const sessionResult = await this.testEndpoint('/api/auth/session', 'GET');
    
    // 3. Test protected endpoint
    const protectedResult = await this.testEndpoint('/api/user/profile', 'GET');
    
    return {
      login: loginResult,
      session: sessionResult,
      protected: protectedResult
    };
  }
  
  async testCRUDOperations(resource: string): Promise<any> {
    console.log(chalk.blue(`Testing CRUD operations for ${resource}...`));
    
    const results: any = {};
    
    // 1. List (GET)
    results.list = await this.testEndpoint(`/api/${resource}`, 'GET');
    
    // 2. Create (POST)
    const testData = this.generateTestData(resource);
    results.create = await this.testEndpoint(`/api/${resource}`, 'POST', {
      data: testData
    });
    
    // 3. Read (GET)
    if (results.create.success && results.create.data?.id) {
      results.read = await this.testEndpoint(
        `/api/${resource}/${results.create.data.id}`, 
        'GET'
      );
      
      // 4. Update (PUT/PATCH)
      results.update = await this.testEndpoint(
        `/api/${resource}/${results.create.data.id}`,
        'PATCH',
        { data: { ...testData, updated: true } }
      );
      
      // 5. Delete (DELETE)
      results.delete = await this.testEndpoint(
        `/api/${resource}/${results.create.data.id}`,
        'DELETE',
        { expectedStatus: 204 }
      );
    }
    
    return results;
  }
  
  async performLoadTest(endpoint: string, options: {
    concurrent: number;
    iterations: number;
    method?: string;
    data?: any;
  }): Promise<any> {
    console.log(chalk.blue(`Load testing ${endpoint}...`));
    
    const results = {
      endpoint,
      concurrent: options.concurrent,
      iterations: options.iterations,
      totalRequests: options.concurrent * options.iterations,
      successCount: 0,
      failureCount: 0,
      responseTimes: [] as number[],
      errors: [] as string[]
    };
    
    const tasks: Promise<APITestResult>[] = [];
    
    for (let i = 0; i < options.iterations; i++) {
      for (let j = 0; j < options.concurrent; j++) {
        tasks.push(
          this.testEndpoint(endpoint, options.method || 'GET', {
            data: options.data
          })
        );
      }
      
      // Wait for batch to complete
      const batchResults = await Promise.all(tasks.splice(0, options.concurrent));
      
      batchResults.forEach(result => {
        if (result.success) {
          results.successCount++;
        } else {
          results.failureCount++;
          if (result.error) results.errors.push(result.error);
        }
        results.responseTimes.push(result.responseTime);
      });
    }
    
    // Calculate statistics
    const stats = this.calculateStats(results.responseTimes);
    
    return {
      ...results,
      statistics: stats
    };
  }
  
  async testWebhooks(webhookUrl: string, payload: any): Promise<any> {
    console.log(chalk.blue('Testing webhook delivery...'));
    
    // Simulate webhook delivery
    const result = await this.testEndpoint(webhookUrl, 'POST', {
      data: payload,
      headers: {
        'X-Webhook-Event': 'test',
        'X-Webhook-Signature': this.generateWebhookSignature(payload)
      }
    });
    
    return {
      delivered: result.success,
      status: result.status,
      responseTime: result.responseTime,
      response: result.data
    };
  }
  
  async generateAPIReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.config.baseUrl,
      totalTests: this.results.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      averageResponseTime: this.calculateAverageResponseTime(),
      endpointResults: this.groupResultsByEndpoint(),
      slowestEndpoints: this.getSlowstEndpoints(5),
      failedEndpoints: this.getFailedEndpoints(),
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join('reports', `api-test-${Date.now()}.json`);
    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    this.displaySummary(report);
    
    return reportPath;
  }
  
  private generateTestData(resource: string): any {
    const testData: Record<string, any> = {
      leads: {
        email: `test${Date.now()}@example.com`,
        name: 'Test Lead',
        company: 'Test Company'
      },
      campaigns: {
        name: `Test Campaign ${Date.now()}`,
        subject: 'Test Subject',
        content: 'Test email content'
      },
      users: {
        email: `user${Date.now()}@example.com`,
        name: 'Test User',
        password: 'TestPassword123!'
      }
    };
    
    return testData[resource] || { name: `Test ${resource}` };
  }
  
  private calculateStats(times: number[]): any {
    if (times.length === 0) return {};
    
    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(sum / times.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  private calculateAverageResponseTime(): number {
    if (this.results.length === 0) return 0;
    const sum = this.results.reduce((acc, r) => acc + r.responseTime, 0);
    return Math.round(sum / this.results.length);
  }
  
  private groupResultsByEndpoint(): Record<string, any> {
    const grouped: Record<string, any> = {};
    
    this.results.forEach(result => {
      const key = `${result.method} ${result.endpoint}`;
      if (!grouped[key]) {
        grouped[key] = {
          calls: 0,
          successes: 0,
          failures: 0,
          avgResponseTime: 0,
          statuses: {}
        };
      }
      
      grouped[key].calls++;
      if (result.success) {
        grouped[key].successes++;
      } else {
        grouped[key].failures++;
      }
      
      grouped[key].statuses[result.status] = 
        (grouped[key].statuses[result.status] || 0) + 1;
    });
    
    return grouped;
  }
  
  private getSlowstEndpoints(count: number): any[] {
    return [...this.results]
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, count)
      .map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        responseTime: r.responseTime,
        status: r.status
      }));
  }
  
  private getFailedEndpoints(): any[] {
    return this.results
      .filter(r => !r.success)
      .map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        status: r.status,
        error: r.error
      }));
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 1000) {
      recommendations.push('Average response time is high (>1s). Consider optimization.');
    }
    
    const failureRate = this.results.filter(r => !r.success).length / this.results.length;
    if (failureRate > 0.05) {
      recommendations.push(`High failure rate (${Math.round(failureRate * 100)}%). Investigate failed endpoints.`);
    }
    
    const slowEndpoints = this.getSlowstEndpoints(3);
    if (slowEndpoints.some(e => e.responseTime > 3000)) {
      recommendations.push('Some endpoints are very slow (>3s). Optimize database queries or add caching.');
    }
    
    return recommendations;
  }
  
  private generateWebhookSignature(payload: any): string {
    // Simple signature generation for testing
    const crypto = require('crypto');
    const secret = 'webhook-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
  
  private displaySummary(report: any) {
    console.log(chalk.blue('\n📊 API Test Summary'));
    console.log(chalk.gray('==================\n'));
    
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(chalk.green(`✅ Successful: ${report.successful}`));
    console.log(chalk.red(`❌ Failed: ${report.failed}`));
    console.log(`⏱️  Avg Response Time: ${report.averageResponseTime}ms`);
    
    if (report.failedEndpoints.length > 0) {
      console.log(chalk.red('\n❌ Failed Endpoints:'));
      report.failedEndpoints.forEach((e: any) => {
        console.log(chalk.red(`  - ${e.method} ${e.endpoint} (${e.status})`));
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      report.recommendations.forEach((r: string) => {
        console.log(chalk.yellow(`  - ${r}`));
      });
    }
  }
  
  async cleanup() {
    if (this.context) {
      await this.context.dispose();
    }
  }
}