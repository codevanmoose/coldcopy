#!/usr/bin/env tsx

import { spawn } from 'child_process';
import { BrowserController } from '../tools/browser-controller';
import { DashboardDiagnostics } from '../tools/dashboard-diagnostics';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface TestSummary {
  timestamp: string;
  baseUrl: string;
  duration: number;
  infrastructure: any;
  playwrightResults: any;
  recommendations: string[];
  criticalIssues: string[];
  overallStatus: 'healthy' | 'degraded' | 'critical';
}

class ComprehensiveTestRunner {
  private baseUrl: string;
  private startTime: number = 0;
  private browserController: BrowserController;
  private diagnostics: DashboardDiagnostics;

  constructor(baseUrl: string = 'https://coldcopy.cc') {
    this.baseUrl = baseUrl;
    this.browserController = new BrowserController();
    this.diagnostics = new DashboardDiagnostics(baseUrl);
  }

  async runCompleteTestSuite(): Promise<TestSummary> {
    this.startTime = Date.now();
    
    console.log(chalk.blue.bold('🧪 ColdCopy Comprehensive Test Suite'));
    console.log(chalk.gray(`Testing: ${this.baseUrl}`));
    console.log(chalk.gray(`Started: ${new Date().toISOString()}\n`));

    // Create directories
    await this.ensureDirectories();

    // Phase 1: Infrastructure diagnostics
    console.log(chalk.yellow('Phase 1: Infrastructure Health Check'));
    const infrastructureHealth = await this.runInfrastructureDiagnostics();

    // Phase 2: Browser-based comprehensive testing
    console.log(chalk.yellow('\nPhase 2: Browser-Based Testing'));
    const browserResults = await this.runBrowserTests();

    // Phase 3: Playwright E2E testing
    console.log(chalk.yellow('\nPhase 3: End-to-End Testing'));
    const playwrightResults = await this.runPlaywrightTests();

    // Phase 4: Generate comprehensive report
    console.log(chalk.yellow('\nPhase 4: Generating Reports'));
    const summary = await this.generateFinalReport({
      infrastructure: infrastructureHealth,
      browser: browserResults,
      playwright: playwrightResults
    });

    console.log(chalk.green.bold('\n✅ Comprehensive test suite completed!'));
    console.log(chalk.gray(`Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`));
    console.log(chalk.gray(`Status: ${summary.overallStatus.toUpperCase()}`));

    return summary;
  }

  private async ensureDirectories() {
    const dirs = ['reports', 'screenshots', 'videos', 'test-results'];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async runInfrastructureDiagnostics() {
    console.log('🔍 Running infrastructure diagnostics...');
    
    try {
      await this.diagnostics.initialize({ headless: true });
      const health = await this.diagnostics.runFullInfrastructureDiagnostics();
      await this.diagnostics.generateInfrastructureReport(health);
      
      // Test AI generation end-to-end
      const aiTests = await this.diagnostics.testAIGenerationEndToEnd();
      
      console.log(chalk.green('✅ Infrastructure diagnostics completed'));
      
      return {
        health,
        aiTests,
        summary: {
          vercel: health.vercel.status,
          supabase: health.supabase.status,
          redis: health.redis.status,
          stripe: health.stripe.status,
          ses: health.ses.status,
          openai: health.aiServices.openai.status,
          anthropic: health.aiServices.anthropic.status,
          overall: health.overall
        }
      };
    } catch (error) {
      console.error(chalk.red('❌ Infrastructure diagnostics failed:'), error.message);
      return {
        error: error.message,
        summary: { overall: 'critical' }
      };
    } finally {
      await this.diagnostics.cleanup();
    }
  }

  private async runBrowserTests() {
    console.log('🌐 Running browser-based tests...');
    
    try {
      await this.browserController.initialize({ 
        headless: true, 
        record: true,
        baseUrl: this.baseUrl 
      });
      
      const results = await this.browserController.runComprehensiveColdCopyTests();
      const reportPath = await this.browserController.generateTestReport();
      
      console.log(chalk.green('✅ Browser tests completed'));
      console.log(chalk.gray(`Report: ${reportPath}`));
      
      return results;
    } catch (error) {
      console.error(chalk.red('❌ Browser tests failed:'), error.message);
      return {
        error: error.message
      };
    } finally {
      await this.browserController.cleanup();
    }
  }

  private async runPlaywrightTests(): Promise<any> {
    console.log('🎭 Running Playwright E2E tests...');
    
    return new Promise((resolve) => {
      const testFiles = [
        'tests/comprehensive/production-health.spec.ts',
        'tests/comprehensive/user-journey-complete.spec.ts'
      ];
      
      // Set environment variables
      const env = {
        ...process.env,
        PLAYWRIGHT_BASE_URL: this.baseUrl,
        CI: 'true'
      };
      
      const playwrightCmd = spawn('npx', [
        'playwright', 'test',
        ...testFiles,
        '--reporter=json',
        '--output-dir=test-results/comprehensive'
      ], {
        env,
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      playwrightCmd.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      playwrightCmd.stderr?.on('data', (data) => {
        stderr += data.toString();
        // Show real-time progress
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
          if (line.trim() && !line.includes('Error:')) {
            console.log(chalk.gray(`  ${line.trim()}`));
          }
        });
      });
      
      playwrightCmd.on('close', async (code) => {
        try {
          let results;
          if (code === 0) {
            console.log(chalk.green('✅ Playwright tests completed successfully'));
            
            // Try to parse results
            try {
              const resultsFile = path.join('test-results', 'comprehensive', 'results.json');
              const resultsExist = await fs.access(resultsFile).then(() => true).catch(() => false);
              if (resultsExist) {
                const resultsContent = await fs.readFile(resultsFile, 'utf-8');
                results = JSON.parse(resultsContent);
              }
            } catch (parseError) {
              console.warn(chalk.yellow('⚠️ Could not parse Playwright results'));
            }
          } else {
            console.error(chalk.red(`❌ Playwright tests failed with code ${code}`));
          }
          
          resolve({
            exitCode: code,
            success: code === 0,
            stdout,
            stderr,
            results: results || null
          });
        } catch (error) {
          console.error(chalk.red('❌ Error processing Playwright results:'), error.message);
          resolve({
            exitCode: code,
            success: false,
            error: error.message
          });
        }
      });
    });
  }

  private async generateFinalReport(testResults: any): Promise<TestSummary> {
    const duration = Date.now() - this.startTime;
    
    // Analyze results
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    
    // Infrastructure analysis
    if (testResults.infrastructure?.summary?.overall === 'critical') {
      criticalIssues.push('Critical infrastructure issues detected');
    }
    
    if (testResults.infrastructure?.summary?.vercel === 'critical') {
      criticalIssues.push('Vercel deployment failed - site inaccessible');
    }
    
    if (testResults.infrastructure?.summary?.supabase === 'critical') {
      criticalIssues.push('Database connection failed');
    }
    
    // Browser test analysis
    if (testResults.browser?.landingPage?.status === 'failed') {
      criticalIssues.push('Landing page not functioning');
    }
    
    if (testResults.browser?.authentication?.status === 'failed') {
      criticalIssues.push('Authentication system not working');
    }
    
    // AI services analysis
    const aiWorking = testResults.infrastructure?.summary?.openai !== 'critical' || 
                     testResults.infrastructure?.summary?.anthropic !== 'critical';
    
    if (!aiWorking) {
      criticalIssues.push('All AI services unavailable');
    }
    
    // Generate recommendations
    if (criticalIssues.length === 0) {
      recommendations.push('✅ All critical systems operational');
      recommendations.push('🚀 Platform ready for production use');
    } else {
      recommendations.push(`🚨 ${criticalIssues.length} critical issues require immediate attention`);
      criticalIssues.forEach(issue => {
        recommendations.push(`• Fix: ${issue}`);
      });
    }
    
    // Performance recommendations
    if (testResults.browser?.performance?.status === 'warning') {
      recommendations.push('⚡ Consider performance optimizations');
    }
    
    // Optional improvements
    if (testResults.infrastructure?.summary?.redis === 'warning') {
      recommendations.push('💾 Set up Redis caching for better performance');
    }
    
    if (testResults.infrastructure?.summary?.ses === 'warning') {
      recommendations.push('📧 Complete SES setup for email functionality');
    }
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (criticalIssues.length > 0) {
      overallStatus = 'critical';
    } else if (testResults.infrastructure?.summary?.overall === 'degraded' || 
               testResults.browser?.performance?.status === 'warning') {
      overallStatus = 'degraded';
    }
    
    const summary: TestSummary = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      duration,
      infrastructure: testResults.infrastructure,
      playwrightResults: testResults.playwright,
      recommendations,
      criticalIssues,
      overallStatus
    };
    
    // Save comprehensive report
    const reportDir = path.join('reports', `comprehensive-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportPath = path.join(reportDir, 'comprehensive-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
    
    // Generate HTML report
    const htmlReport = await this.generateHTMLSummary(summary);
    const htmlPath = path.join(reportDir, 'comprehensive-test-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    
    console.log(chalk.blue('\n📊 Final Report Generated:'));
    console.log(chalk.gray(`JSON: ${reportPath}`));
    console.log(chalk.gray(`HTML: ${htmlPath}`));
    
    // Print summary to console
    this.printConsoleSummary(summary);
    
    return summary;
  }

  private async generateHTMLSummary(summary: TestSummary): Promise<string> {
    const statusColor = summary.overallStatus === 'healthy' ? '#059669' : 
                       summary.overallStatus === 'degraded' ? '#d97706' : '#dc2626';
    
    const statusIcon = summary.overallStatus === 'healthy' ? '✅' : 
                      summary.overallStatus === 'degraded' ? '⚠️' : '❌';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ColdCopy Comprehensive Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .status-card { background: white; border-radius: 12px; padding: 30px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .status-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { text-align: center; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2.5em; font-weight: bold; margin-bottom: 8px; color: ${statusColor}; }
        .metric-label { color: #64748b; font-weight: 500; }
        .section { background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section h2 { margin: 0 0 20px 0; color: #1e293b; }
        .recommendation { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
        .critical-issue { background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px; margin-bottom: 10px; color: #991b1b; }
        .infrastructure-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .service-status { text-align: center; padding: 15px; border-radius: 6px; }
        .service-status.healthy { background: #ecfdf5; color: #059669; }
        .service-status.warning { background: #fef3c7; color: #d97706; }
        .service-status.critical { background: #fef2f2; color: #dc2626; }
        .duration { color: #64748b; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 ColdCopy Comprehensive Test Report</h1>
            <p>Generated: ${new Date(summary.timestamp).toLocaleString()}</p>
            <p>Base URL: ${summary.baseUrl}</p>
            <p>Duration: ${Math.round(summary.duration / 1000)}s</p>
        </div>
        
        <div class="status-overview">
            <div class="metric">
                <div class="metric-value">${statusIcon}</div>
                <div class="metric-label">Overall Status</div>
                <div style="font-weight: bold; color: ${statusColor}; margin-top: 8px; text-transform: uppercase;">
                    ${summary.overallStatus}
                </div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #dc2626">${summary.criticalIssues.length}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #059669">${summary.recommendations.filter(r => r.includes('✅')).length}</div>
                <div class="metric-label">Healthy Systems</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #3b82f6">${Math.round(summary.duration / 1000)}s</div>
                <div class="metric-label">Test Duration</div>
            </div>
        </div>
        
        ${summary.criticalIssues.length > 0 ? `
        <div class="section">
            <h2>🚨 Critical Issues</h2>
            ${summary.criticalIssues.map(issue => `<div class="critical-issue">${issue}</div>`).join('')}
        </div>
        ` : ''}
        
        <div class="section">
            <h2>🏗️ Infrastructure Status</h2>
            <div class="infrastructure-grid">
                ${Object.entries(summary.infrastructure?.summary || {}).map(([service, status]) => `
                    <div class="service-status ${status}">
                        <div style="font-weight: bold; margin-bottom: 5px;">${service.charAt(0).toUpperCase() + service.slice(1)}</div>
                        <div style="font-size: 0.9em;">${status}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Recommendations</h2>
            ${summary.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
        </div>
        
        <div class="section">
            <h2>📊 Test Results Summary</h2>
            <p>Comprehensive testing completed with the following results:</p>
            <ul>
                <li><strong>Infrastructure Health:</strong> ${summary.infrastructure?.summary?.overall || 'Unknown'}</li>
                <li><strong>Browser Tests:</strong> ${Object.keys(summary.infrastructure?.health || {}).length} services checked</li>
                <li><strong>E2E Tests:</strong> ${summary.playwrightResults?.success ? 'Passed' : 'Issues detected'}</li>
                <li><strong>Total Duration:</strong> ${Math.round(summary.duration / 1000)} seconds</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
  }

  private printConsoleSummary(summary: TestSummary) {
    console.log(chalk.blue.bold('\n📊 COMPREHENSIVE TEST SUMMARY'));
    console.log(chalk.blue('━'.repeat(50)));
    
    // Status
    const statusColor = summary.overallStatus === 'healthy' ? chalk.green : 
                       summary.overallStatus === 'degraded' ? chalk.yellow : chalk.red;
    
    console.log(`${chalk.bold('Overall Status:')} ${statusColor(summary.overallStatus.toUpperCase())}`);
    console.log(`${chalk.bold('Duration:')} ${Math.round(summary.duration / 1000)}s`);
    console.log(`${chalk.bold('Timestamp:')} ${summary.timestamp}`);
    
    // Critical issues
    if (summary.criticalIssues.length > 0) {
      console.log(chalk.red.bold('\n🚨 CRITICAL ISSUES:'));
      summary.criticalIssues.forEach(issue => {
        console.log(chalk.red(`  • ${issue}`));
      });
    }
    
    // Infrastructure summary
    if (summary.infrastructure?.summary) {
      console.log(chalk.blue.bold('\n🏗️ INFRASTRUCTURE STATUS:'));
      Object.entries(summary.infrastructure.summary).forEach(([service, status]) => {
        const statusIcon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
        const serviceColor = status === 'healthy' ? chalk.green : status === 'warning' ? chalk.yellow : chalk.red;
        console.log(`  ${statusIcon} ${chalk.bold(service)}: ${serviceColor(status)}`);
      });
    }
    
    // Recommendations
    console.log(chalk.blue.bold('\n🎯 KEY RECOMMENDATIONS:'));
    summary.recommendations.slice(0, 5).forEach(rec => {
      console.log(`  ${rec}`);
    });
    
    if (summary.recommendations.length > 5) {
      console.log(chalk.gray(`  ... and ${summary.recommendations.length - 5} more recommendations`));
    }
    
    console.log(chalk.blue('━'.repeat(50)));
  }
}

// Main execution
async function main() {
  const baseUrl = process.argv[2] || process.env.PLAYWRIGHT_BASE_URL || 'https://coldcopy.cc';
  
  console.log(chalk.blue('Starting ColdCopy Comprehensive Test Suite...'));
  console.log(chalk.gray(`Target URL: ${baseUrl}\n`));
  
  const runner = new ComprehensiveTestRunner(baseUrl);
  
  try {
    const summary = await runner.runCompleteTestSuite();
    
    // Exit with appropriate code
    const exitCode = summary.overallStatus === 'critical' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Comprehensive test suite failed:'));
    console.error(chalk.red(error.message));
    
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n⚠️ Test suite interrupted by user'));
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n⚠️ Test suite terminated'));
  process.exit(143);
});

// Run if called directly
if (require.main === module) {
  main();
}

export { ComprehensiveTestRunner };