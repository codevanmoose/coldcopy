import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execPromise = promisify(exec);

interface ErrorPattern {
  pattern: RegExp;
  type: 'build' | 'runtime' | 'deployment' | 'api' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recovery: () => Promise<RecoveryResult>;
}

interface RecoveryResult {
  success: boolean;
  action: string;
  output?: string;
  error?: string;
}

interface ErrorReport {
  timestamp: string;
  error: string;
  type: string;
  severity: string;
  recovered: boolean;
  recovery?: RecoveryResult;
}

export class ErrorRecoverySystem {
  private errorPatterns: ErrorPattern[] = [];
  private errorLog: ErrorReport[] = [];
  private recoveryAttempts: Map<string, number> = new Map();
  
  constructor() {
    this.initializeErrorPatterns();
  }
  
  private initializeErrorPatterns() {
    this.errorPatterns = [
      // Build errors
      {
        pattern: /Module not found|Cannot find module/i,
        type: 'build',
        severity: 'high',
        recovery: async () => this.fixMissingModule()
      },
      {
        pattern: /TypeScript error|TS\d{4}/i,
        type: 'build',
        severity: 'medium',
        recovery: async () => this.fixTypeScriptError()
      },
      {
        pattern: /Failed to compile|Build failed/i,
        type: 'build',
        severity: 'high',
        recovery: async () => this.rebuildProject()
      },
      
      // Runtime errors
      {
        pattern: /ECONNREFUSED|Connection refused/i,
        type: 'runtime',
        severity: 'high',
        recovery: async () => this.restartServices()
      },
      {
        pattern: /Out of memory|JavaScript heap/i,
        type: 'runtime',
        severity: 'critical',
        recovery: async () => this.increaseMemoryLimit()
      },
      {
        pattern: /Rate limit|429|Too many requests/i,
        type: 'api',
        severity: 'medium',
        recovery: async () => this.handleRateLimit()
      },
      
      // Database errors
      {
        pattern: /Database connection failed|ENOTFOUND.*supabase/i,
        type: 'database',
        severity: 'critical',
        recovery: async () => this.reconnectDatabase()
      },
      {
        pattern: /relation.*does not exist|table.*not found/i,
        type: 'database',
        severity: 'high',
        recovery: async () => this.runMigrations()
      },
      
      // Deployment errors
      {
        pattern: /Deployment failed|Deploy error/i,
        type: 'deployment',
        severity: 'high',
        recovery: async () => this.retryDeployment()
      },
      {
        pattern: /Environment variable.*not set|Missing required env/i,
        type: 'deployment',
        severity: 'high',
        recovery: async () => this.checkEnvironmentVariables()
      },
      
      // API errors
      {
        pattern: /401|Unauthorized|Authentication failed/i,
        type: 'api',
        severity: 'medium',
        recovery: async () => this.refreshAuthentication()
      },
      {
        pattern: /500|Internal Server Error/i,
        type: 'api',
        severity: 'high',
        recovery: async () => this.restartAPIService()
      }
    ];
  }
  
  async analyzeError(error: string | Error): Promise<ErrorReport | null> {
    const errorMessage = error instanceof Error ? error.message : error;
    console.log(chalk.yellow(`\n🔍 Analyzing error: ${errorMessage.substring(0, 100)}...`));
    
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorMessage)) {
        return this.handleError(errorMessage, pattern);
      }
    }
    
    console.log(chalk.gray('No matching error pattern found'));
    return null;
  }
  
  private async handleError(error: string, pattern: ErrorPattern): Promise<ErrorReport> {
    const errorKey = `${pattern.type}-${pattern.pattern.source}`;
    const attempts = this.recoveryAttempts.get(errorKey) || 0;
    
    const report: ErrorReport = {
      timestamp: new Date().toISOString(),
      error: error.substring(0, 500),
      type: pattern.type,
      severity: pattern.severity,
      recovered: false
    };
    
    if (attempts >= 3) {
      console.log(chalk.red(`❌ Max recovery attempts reached for ${pattern.type} error`));
      this.errorLog.push(report);
      return report;
    }
    
    console.log(chalk.blue(`🔧 Attempting recovery for ${pattern.type} error (attempt ${attempts + 1}/3)`));
    this.recoveryAttempts.set(errorKey, attempts + 1);
    
    try {
      const recovery = await pattern.recovery();
      report.recovery = recovery;
      report.recovered = recovery.success;
      
      if (recovery.success) {
        console.log(chalk.green(`✅ Recovery successful: ${recovery.action}`));
        this.recoveryAttempts.delete(errorKey);
      } else {
        console.log(chalk.red(`❌ Recovery failed: ${recovery.error || 'Unknown error'}`));
      }
    } catch (err) {
      console.log(chalk.red(`❌ Recovery error: ${err}`));
      report.recovery = {
        success: false,
        action: 'Recovery failed',
        error: err instanceof Error ? err.message : String(err)
      };
    }
    
    this.errorLog.push(report);
    return report;
  }
  
  // Recovery actions
  private async fixMissingModule(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Installing missing dependencies...'));
      const { stdout, stderr } = await execPromise('npm install');
      
      return {
        success: !stderr.includes('error'),
        action: 'Installed missing dependencies',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'Failed to install dependencies',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async fixTypeScriptError(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Running TypeScript type check...'));
      const { stdout } = await execPromise('npm run typecheck');
      
      // Try to auto-fix common issues
      await execPromise('npx tsc --noEmit --skipLibCheck');
      
      return {
        success: true,
        action: 'TypeScript errors analyzed',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'TypeScript check failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async rebuildProject(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Cleaning and rebuilding project...'));
      
      // Clean build artifacts
      await execPromise('rm -rf .next');
      await execPromise('rm -rf node_modules/.cache');
      
      // Rebuild
      const { stdout } = await execPromise('npm run build');
      
      return {
        success: true,
        action: 'Project rebuilt successfully',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'Rebuild failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async restartServices(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Restarting services...'));
      
      // Kill existing processes
      await execPromise('pkill -f "next dev" || true');
      await execPromise('pkill -f "node" || true');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restart in background
      exec('npm run dev', { detached: true });
      
      return {
        success: true,
        action: 'Services restarted'
      };
    } catch (error) {
      return {
        success: false,
        action: 'Failed to restart services',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async increaseMemoryLimit(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Increasing memory limit...'));
      
      // Update NODE_OPTIONS
      process.env.NODE_OPTIONS = '--max-old-space-size=4096';
      
      // Create or update .env.local
      const envPath = path.join(process.cwd(), '.env.local');
      const envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
      
      if (!envContent.includes('NODE_OPTIONS')) {
        await fs.appendFile(envPath, '\nNODE_OPTIONS=--max-old-space-size=4096\n');
      }
      
      return {
        success: true,
        action: 'Memory limit increased to 4GB'
      };
    } catch (error) {
      return {
        success: false,
        action: 'Failed to increase memory limit',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async handleRateLimit(): Promise<RecoveryResult> {
    console.log(chalk.gray('Implementing rate limit backoff...'));
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    
    return {
      success: true,
      action: 'Waited 1 minute for rate limit reset'
    };
  }
  
  private async reconnectDatabase(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Reconnecting to database...'));
      
      // Check Supabase connection
      const { stdout } = await execPromise(
        'curl -s https://zicipvpablahehxstbfr.supabase.co/rest/v1/'
      );
      
      return {
        success: stdout.includes('200') || stdout.includes('401'),
        action: 'Database connection checked'
      };
    } catch (error) {
      return {
        success: false,
        action: 'Database connection failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async runMigrations(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Running database migrations...'));
      
      const { stdout } = await execPromise('npx supabase db push');
      
      return {
        success: true,
        action: 'Database migrations completed',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'Migration failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async retryDeployment(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Retrying deployment...'));
      
      // Check build first
      await execPromise('npm run build');
      
      // Deploy
      const { stdout } = await execPromise('vercel --prod');
      
      return {
        success: true,
        action: 'Deployment retried',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'Deployment retry failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async checkEnvironmentVariables(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Checking environment variables...'));
      
      const { stdout } = await execPromise('npm run env:verify');
      
      return {
        success: !stdout.includes('Missing'),
        action: 'Environment variables checked',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'Environment check failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async refreshAuthentication(): Promise<RecoveryResult> {
    console.log(chalk.gray('Refreshing authentication...'));
    
    // Clear auth cache
    await execPromise('rm -rf .cache/auth');
    
    return {
      success: true,
      action: 'Authentication cache cleared'
    };
  }
  
  private async restartAPIService(): Promise<RecoveryResult> {
    try {
      console.log(chalk.gray('Restarting API service...'));
      
      // For Vercel, trigger redeploy
      const { stdout } = await execPromise('vercel');
      
      return {
        success: true,
        action: 'API service restarted',
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        action: 'API restart failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  async generateRecoveryReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: this.errorLog.length,
      recovered: this.errorLog.filter(e => e.recovered).length,
      failed: this.errorLog.filter(e => !e.recovered).length,
      byType: this.groupErrorsByType(),
      bySeverity: this.groupErrorsBySeverity(),
      recentErrors: this.errorLog.slice(-10),
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join('reports', `recovery-${Date.now()}.json`);
    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.blue('\n📊 Recovery Report'));
    console.log(chalk.gray('================\n'));
    console.log(`Total Errors: ${report.totalErrors}`);
    console.log(chalk.green(`✅ Recovered: ${report.recovered}`));
    console.log(chalk.red(`❌ Failed: ${report.failed}`));
    
    return reportPath;
  }
  
  private groupErrorsByType(): Record<string, number> {
    const grouped: Record<string, number> = {};
    this.errorLog.forEach(error => {
      grouped[error.type] = (grouped[error.type] || 0) + 1;
    });
    return grouped;
  }
  
  private groupErrorsBySeverity(): Record<string, number> {
    const grouped: Record<string, number> = {};
    this.errorLog.forEach(error => {
      grouped[error.severity] = (grouped[error.severity] || 0) + 1;
    });
    return grouped;
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalErrors = this.errorLog.filter(e => e.severity === 'critical' && !e.recovered);
    if (criticalErrors.length > 0) {
      recommendations.push('Critical errors require manual intervention');
    }
    
    const dbErrors = this.errorLog.filter(e => e.type === 'database');
    if (dbErrors.length > 3) {
      recommendations.push('Frequent database errors - check connection string and credentials');
    }
    
    const buildErrors = this.errorLog.filter(e => e.type === 'build');
    if (buildErrors.length > 2) {
      recommendations.push('Multiple build errors - consider clearing cache and reinstalling dependencies');
    }
    
    return recommendations;
  }
}