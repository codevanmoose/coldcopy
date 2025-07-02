import { BrowserController } from './browser-controller';
import fs from 'fs/promises';
import path from 'path';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  details: any;
  responseTime?: number;
  lastChecked: string;
}

interface InfrastructureHealth {
  vercel: ServiceStatus;
  supabase: ServiceStatus;
  redis: ServiceStatus;
  stripe: ServiceStatus;
  ses: ServiceStatus;
  aiServices: {
    openai: ServiceStatus;
    anthropic: ServiceStatus;
  };
  overall: 'healthy' | 'degraded' | 'critical';
}

export class DashboardDiagnostics {
  private browserController: BrowserController;
  private baseUrl: string;

  constructor(baseUrl: string = 'https://coldcopy.cc') {
    this.browserController = new BrowserController();
    this.baseUrl = baseUrl;
  }

  async initialize(options?: { headless?: boolean }) {
    await this.browserController.initialize({
      headless: options?.headless ?? true,
      record: true
    });
  }

  async runFullInfrastructureDiagnostics(): Promise<InfrastructureHealth> {
    console.log('🔍 Running Full Infrastructure Diagnostics...');

    const health: InfrastructureHealth = {
      vercel: await this.checkVercelStatus(),
      supabase: await this.checkSupabaseStatus(),
      redis: await this.checkRedisStatus(),
      stripe: await this.checkStripeStatus(),
      ses: await this.checkSESStatus(),
      aiServices: {
        openai: await this.checkOpenAIStatus(),
        anthropic: await this.checkAnthropicStatus()
      },
      overall: 'healthy'
    };

    // Determine overall health
    const services = [
      health.vercel,
      health.supabase,
      health.redis,
      health.stripe,
      health.ses,
      health.aiServices.openai,
      health.aiServices.anthropic
    ];

    const criticalCount = services.filter(s => s.status === 'critical').length;
    const warningCount = services.filter(s => s.status === 'warning').length;

    if (criticalCount > 0) {
      health.overall = 'critical';
    } else if (warningCount > 2) {
      health.overall = 'degraded';
    }

    return health;
  }

  private async checkVercelStatus(): Promise<ServiceStatus> {
    console.log('Checking Vercel deployment status...');
    
    try {
      const start = Date.now();
      
      // Check if site is accessible
      const response = await fetch(this.baseUrl);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Vercel',
          status: 'critical',
          details: {
            statusCode: response.status,
            statusText: response.statusText,
            error: 'Site not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      // Check response headers for Vercel indicators
      const headers = Object.fromEntries(response.headers.entries());
      const isVercel = headers['server'] === 'Vercel' || headers['x-vercel-id'];

      // Check if it's actually our app
      const html = await response.text();
      const isColdCopy = html.includes('ColdCopy') || html.includes('cold outreach');

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!isVercel) {
        issues.push('Not detected as Vercel deployment');
        status = 'warning';
      }

      if (!isColdCopy) {
        issues.push('ColdCopy content not detected');
        status = 'critical';
      }

      if (responseTime > 3000) {
        issues.push('Slow response time');
        status = status === 'critical' ? 'critical' : 'warning';
      }

      return {
        name: 'Vercel',
        status,
        details: {
          responseTime,
          headers: {
            server: headers['server'],
            'x-vercel-id': headers['x-vercel-id'],
            'x-vercel-cache': headers['x-vercel-cache']
          },
          contentDetected: isColdCopy,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Vercel',
        status: 'critical',
        details: {
          error: error.message,
          type: 'connection_failed'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkSupabaseStatus(): Promise<ServiceStatus> {
    console.log('Checking Supabase database status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-supabase-config`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Supabase',
          status: 'critical',
          details: {
            statusCode: response.status,
            error: 'Supabase config endpoint not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      // Check if connection test failed
      if (data.config?.connection_test !== 'success') {
        status = 'critical';
        issues.push('Database connection failed');
      }

      if (data.performance && data.performance.queryTime > 1000) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push('Slow database queries');
      }

      return {
        name: 'Supabase',
        status,
        details: {
          ...data,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Supabase',
        status: 'critical',
        details: {
          error: error.message,
          type: 'api_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkRedisStatus(): Promise<ServiceStatus> {
    console.log('Checking Redis/Upstash status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-redis`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Redis',
          status: 'warning', // Redis is optional for core functionality
          details: {
            statusCode: response.status,
            error: 'Redis test endpoint not accessible',
            note: 'Redis is optional for core functionality'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = data.connected ? 'healthy' : 'warning';
      const issues: string[] = [];

      if (!data.connected) {
        issues.push('Redis connection failed - caching disabled');
      }

      if (data.performance && data.performance.latency > 100) {
        issues.push('High Redis latency');
      }

      return {
        name: 'Redis',
        status,
        details: {
          ...data,
          issues,
          note: 'Redis improves performance but is not required for core functionality'
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Redis',
        status: 'warning',
        details: {
          error: error.message,
          type: 'api_error',
          note: 'Redis is optional for core functionality'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkStripeStatus(): Promise<ServiceStatus> {
    console.log('Checking Stripe integration status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-stripe-config`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Stripe',
          status: 'warning',
          details: {
            statusCode: response.status,
            error: 'Stripe config endpoint not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!data.configured) {
        status = 'warning';
        issues.push('Stripe not properly configured');
      }

      if (data.testMode === true) {
        issues.push('Stripe in test mode - no real payments processed');
      }

      return {
        name: 'Stripe',
        status,
        details: {
          ...data,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Stripe',
        status: 'warning',
        details: {
          error: error.message,
          type: 'api_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkSESStatus(): Promise<ServiceStatus> {
    console.log('Checking Amazon SES status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/ses-status`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Amazon SES',
          status: 'warning',
          details: {
            statusCode: response.status,
            error: 'SES status endpoint not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (data.status !== 'connected') {
        status = 'critical';
        issues.push('SES not configured - email sending disabled');
      }

      if (data.sandboxMode === true) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push('SES in sandbox mode - limited to verified emails');
      }

      if (data.quotaUsed && data.quotaUsed > 0.8) {
        issues.push('SES quota nearly exhausted');
      }

      return {
        name: 'Amazon SES',
        status,
        details: {
          ...data,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Amazon SES',
        status: 'critical',
        details: {
          error: error.message,
          type: 'api_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkOpenAIStatus(): Promise<ServiceStatus> {
    console.log('Checking OpenAI API status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-ai-config`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'OpenAI',
          status: 'warning',
          details: {
            statusCode: response.status,
            error: 'AI config endpoint not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!data.config?.openai?.configured) {
        status = 'critical';
        issues.push('OpenAI API not configured');
      }

      if (data.config?.openai?.rateLimited) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push('OpenAI rate limit reached');
      }

      return {
        name: 'OpenAI',
        status,
        details: {
          configured: data.config?.openai?.configured,
          model: data.config?.openai?.model,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'OpenAI',
        status: 'critical',
        details: {
          error: error.message,
          type: 'api_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkAnthropicStatus(): Promise<ServiceStatus> {
    console.log('Checking Anthropic Claude API status...');
    
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-ai-config`);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          name: 'Anthropic',
          status: 'warning',
          details: {
            statusCode: response.status,
            error: 'AI config endpoint not accessible'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!data.config?.anthropic?.configured) {
        status = 'critical';
        issues.push('Anthropic API not configured');
      }

      if (data.config?.anthropic?.rateLimited) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push('Anthropic rate limit reached');
      }

      return {
        name: 'Anthropic',
        status,
        details: {
          configured: data.config?.anthropic?.configured,
          model: data.config?.anthropic?.model,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: 'Anthropic',
        status: 'critical',
        details: {
          error: error.message,
          type: 'api_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  async testAIGenerationEndToEnd(): Promise<{
    gpt4: ServiceStatus;
    claude: ServiceStatus;
  }> {
    console.log('Testing AI generation end-to-end...');

    const gpt4Result = await this.testAIGeneration('gpt-4');
    const claudeResult = await this.testAIGeneration('claude');

    return {
      gpt4: gpt4Result,
      claude: claudeResult
    };
  }

  private async testAIGeneration(provider: 'gpt-4' | 'claude'): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test-ai-generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          prompt: 'Write a brief professional email introducing our AI-powered cold outreach platform.',
          test: true
        })
      });
      const responseTime = Date.now() - start;

      if (!response.ok) {
        return {
          name: provider === 'gpt-4' ? 'GPT-4 Generation' : 'Claude Generation',
          status: 'critical',
          details: {
            statusCode: response.status,
            error: 'AI generation failed'
          },
          responseTime,
          lastChecked: new Date().toISOString()
        };
      }

      const data = await response.json();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!data.success) {
        status = 'critical';
        issues.push('AI generation returned error');
      }

      if (!data.content || data.content.length < 50) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push('AI generated content too short or missing');
      }

      if (responseTime > 10000) {
        issues.push('AI generation taking too long');
      }

      return {
        name: provider === 'gpt-4' ? 'GPT-4 Generation' : 'Claude Generation',
        status,
        details: {
          success: data.success,
          contentLength: data.content?.length || 0,
          tokensUsed: data.tokens,
          issues
        },
        responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: provider === 'gpt-4' ? 'GPT-4 Generation' : 'Claude Generation',
        status: 'critical',
        details: {
          error: error.message,
          type: 'generation_error'
        },
        lastChecked: new Date().toISOString()
      };
    }
  }

  async generateInfrastructureReport(health: InfrastructureHealth): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join('reports', `infrastructure-${timestamp}`);
    await fs.mkdir(reportDir, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      overall: health.overall,
      summary: {
        healthy: this.countServicesByStatus(health, 'healthy'),
        warning: this.countServicesByStatus(health, 'warning'),
        critical: this.countServicesByStatus(health, 'critical'),
        unknown: this.countServicesByStatus(health, 'unknown')
      },
      services: health,
      recommendations: this.generateInfrastructureRecommendations(health)
    };

    const reportPath = path.join(reportDir, 'infrastructure-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateInfrastructureHTMLReport(report);
    const htmlPath = path.join(reportDir, 'infrastructure-report.html');
    await fs.writeFile(htmlPath, htmlReport);

    console.log(`\n📊 Infrastructure report generated:`);
    console.log(`JSON: ${reportPath}`);
    console.log(`HTML: ${htmlPath}`);

    return reportPath;
  }

  private countServicesByStatus(health: InfrastructureHealth, status: string): number {
    const services = [
      health.vercel,
      health.supabase,
      health.redis,
      health.stripe,
      health.ses,
      health.aiServices.openai,
      health.aiServices.anthropic
    ];
    return services.filter(s => s.status === status).length;
  }

  private generateInfrastructureRecommendations(health: InfrastructureHealth): string[] {
    const recommendations: string[] = [];

    if (health.overall === 'critical') {
      recommendations.push('🚨 CRITICAL: Platform has critical issues that prevent core functionality');
    } else if (health.overall === 'degraded') {
      recommendations.push('⚠️ DEGRADED: Platform performance may be impacted');
    }

    // Service-specific recommendations
    if (health.vercel.status === 'critical') {
      recommendations.push('🌐 Vercel deployment failed - site may be inaccessible');
    }

    if (health.supabase.status === 'critical') {
      recommendations.push('💾 Database connection failed - all data operations will fail');
    }

    if (health.redis.status === 'warning') {
      recommendations.push('⚡ Redis caching unavailable - reduced performance expected');
    }

    if (health.stripe.status === 'warning' || health.stripe.status === 'critical') {
      recommendations.push('💳 Payment processing issues - billing functionality affected');
    }

    if (health.ses.status === 'critical') {
      recommendations.push('📧 Email sending disabled - all email functionality unavailable');
    } else if (health.ses.status === 'warning') {
      recommendations.push('📧 Email sending limited - check SES configuration and quotas');
    }

    if (health.aiServices.openai.status === 'critical' && health.aiServices.anthropic.status === 'critical') {
      recommendations.push('🤖 All AI services unavailable - core AI features disabled');
    } else if (health.aiServices.openai.status === 'critical') {
      recommendations.push('🤖 GPT-4 unavailable - falling back to Claude for AI generation');
    } else if (health.aiServices.anthropic.status === 'critical') {
      recommendations.push('🤖 Claude unavailable - falling back to GPT-4 for AI generation');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All systems operational - platform ready for production use');
    }

    return recommendations;
  }

  private generateInfrastructureHTMLReport(report: any): string {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'healthy': return '#059669';
        case 'warning': return '#d97706';
        case 'critical': return '#dc2626';
        default: return '#6b7280';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'healthy': return '✅';
        case 'warning': return '⚠️';
        case 'critical': return '❌';
        default: return '❓';
      }
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ColdCopy Infrastructure Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .status-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .status-card { text-align: center; padding: 20px; border-radius: 8px; }
        .status-card.healthy { background: #ecfdf5; border: 1px solid #d1fae5; }
        .status-card.degraded { background: #fef3c7; border: 1px solid #fde68a; }
        .status-card.critical { background: #fef2f2; border: 1px solid #fecaca; }
        .status-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .service-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .service-header { padding: 15px; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; }
        .service-body { padding: 15px; }
        .status-badge { padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.875em; font-weight: 500; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .issues { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 10px; margin-top: 10px; }
        .issue-item { color: #991b1b; margin-bottom: 4px; }
        .recommendations { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; }
        .recommendation-item { margin-bottom: 10px; font-size: 1.1em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏗️ ColdCopy Infrastructure Status</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Base URL: ${report.baseUrl}</p>
        </div>
        
        <div class="content">
            <div class="status-overview">
                <div class="status-card ${report.overall}">
                    <div class="status-value" style="color: ${getStatusColor(report.overall)}">
                        ${getStatusIcon(report.overall)}
                    </div>
                    <div>Overall Status</div>
                    <div style="font-weight: bold; text-transform: uppercase; color: ${getStatusColor(report.overall)}">
                        ${report.overall}
                    </div>
                </div>
                <div class="status-card">
                    <div class="status-value" style="color: #059669">${report.summary.healthy}</div>
                    <div>Healthy</div>
                </div>
                <div class="status-card">
                    <div class="status-value" style="color: #d97706">${report.summary.warning}</div>
                    <div>Warnings</div>
                </div>
                <div class="status-card">
                    <div class="status-value" style="color: #dc2626">${report.summary.critical}</div>
                    <div>Critical</div>
                </div>
            </div>
            
            <h2>Service Status</h2>
            <div class="service-grid">
                ${Object.entries(report.services).filter(([key]) => key !== 'overall' && key !== 'aiServices').map(([key, service]: [string, any]) => `
                    <div class="service-card">
                        <div class="service-header">
                            <h3>${service.name}</h3>
                            <span class="status-badge" style="background-color: ${getStatusColor(service.status)}">
                                ${getStatusIcon(service.status)} ${service.status.toUpperCase()}
                            </span>
                        </div>
                        <div class="service-body">
                            ${service.responseTime ? `<div class="metric"><span>Response Time:</span><span>${Math.round(service.responseTime)}ms</span></div>` : ''}
                            <div class="metric"><span>Last Checked:</span><span>${new Date(service.lastChecked).toLocaleString()}</span></div>
                            ${service.details?.issues?.length > 0 ? `
                                <div class="issues">
                                    <strong>Issues:</strong>
                                    ${service.details.issues.map((issue: string) => `<div class="issue-item">• ${issue}</div>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
                
                <!-- AI Services -->
                <div class="service-card">
                    <div class="service-header">
                        <h3>OpenAI (GPT-4)</h3>
                        <span class="status-badge" style="background-color: ${getStatusColor(report.services.aiServices.openai.status)}">
                            ${getStatusIcon(report.services.aiServices.openai.status)} ${report.services.aiServices.openai.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="service-body">
                        ${report.services.aiServices.openai.responseTime ? `<div class="metric"><span>Response Time:</span><span>${Math.round(report.services.aiServices.openai.responseTime)}ms</span></div>` : ''}
                        <div class="metric"><span>Last Checked:</span><span>${new Date(report.services.aiServices.openai.lastChecked).toLocaleString()}</span></div>
                        ${report.services.aiServices.openai.details?.issues?.length > 0 ? `
                            <div class="issues">
                                <strong>Issues:</strong>
                                ${report.services.aiServices.openai.details.issues.map((issue: string) => `<div class="issue-item">• ${issue}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="service-card">
                    <div class="service-header">
                        <h3>Anthropic (Claude)</h3>
                        <span class="status-badge" style="background-color: ${getStatusColor(report.services.aiServices.anthropic.status)}">
                            ${getStatusIcon(report.services.aiServices.anthropic.status)} ${report.services.aiServices.anthropic.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="service-body">
                        ${report.services.aiServices.anthropic.responseTime ? `<div class="metric"><span>Response Time:</span><span>${Math.round(report.services.aiServices.anthropic.responseTime)}ms</span></div>` : ''}
                        <div class="metric"><span>Last Checked:</span><span>${new Date(report.services.aiServices.anthropic.lastChecked).toLocaleString()}</span></div>
                        ${report.services.aiServices.anthropic.details?.issues?.length > 0 ? `
                            <div class="issues">
                                <strong>Issues:</strong>
                                ${report.services.aiServices.anthropic.details.issues.map((issue: string) => `<div class="issue-item">• ${issue}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${report.recommendations.length > 0 ? `
                <div class="recommendations">
                    <h2>🎯 Recommendations</h2>
                    ${report.recommendations.map((rec: string) => `<div class="recommendation-item">${rec}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
  }

  async cleanup() {
    await this.browserController.cleanup();
  }
}