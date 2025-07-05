import {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  FullConfig,
  Suite,
} from '@playwright/test/reporter';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestSummary {
  title: string;
  file: string;
  status: string;
  duration: number;
  error?: {
    message: string;
    stack?: string;
  };
  attachments: Array<{
    name: string;
    path?: string;
    contentType: string;
  }>;
  retries: number;
}

interface ReportSummary {
  status: string;
  duration: number;
  startTime: string;
  endTime: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  timedOut: number;
  tests: TestSummary[];
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export default class ColdCopyReporter implements Reporter {
  private results: TestSummary[] = [];
  private startTime = 0;
  private errors: string[] = [];
  private config: FullConfig | null = null;

  onBegin(config: FullConfig): void {
    this.config = config;
    this.startTime = Date.now();
    console.log('\n🧪 Starting ColdCopy Platform Tests...\n');
    console.log(`Base URL: ${config.projects[0].use?.baseURL}`);
    console.log(`Total test files: ${config.testDir}`);
    console.log(`Workers: ${config.workers || 'default'}`);
    console.log('-----------------------------------\n');
  }

  onTestBegin(test: TestCase): void {
    console.log(`▶️  ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const summary: TestSummary = {
      title: test.title,
      file: path.relative(process.cwd(), test.location.file),
      status: result.status,
      duration: result.duration,
      retries: result.retry,
      attachments: result.attachments.map((a) => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
      })),
    };

    if (result.error) {
      summary.error = {
        message: result.error.message || 'Unknown error',
        stack: result.error.stack,
      };
    }

    this.results.push(summary);

    // Real-time feedback
    const statusEmoji = {
      passed: '✅',
      failed: '❌',
      timedOut: '⏱️',
      skipped: '⏭️',
      interrupted: '🛑',
    }[result.status] || '❓';

    console.log(`${statusEmoji} ${test.title} (${result.duration}ms)`);

    if (result.status === 'failed' && result.error) {
      console.log(`   └─ Error: ${result.error.message}`);
      this.errors.push(`${test.title}: ${result.error.message}`);
    }

    // Log stdout/stderr if present
    if (result.stdout.length > 0) {
      console.log('   └─ Output:', result.stdout.join('\n'));
    }
    if (result.stderr.length > 0) {
      console.log('   └─ Errors:', result.stderr.join('\n'));
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    // Calculate statistics
    const stats = {
      total: this.results.length,
      passed: this.results.filter((r) => r.status === 'passed').length,
      failed: this.results.filter((r) => r.status === 'failed').length,
      skipped: this.results.filter((r) => r.status === 'skipped').length,
      flaky: this.results.filter((r) => r.retries > 0 && r.status === 'passed').length,
      timedOut: this.results.filter((r) => r.status === 'timedOut').length,
    };

    // Generate suggestions based on results
    const suggestions = this.generateSuggestions(stats);

    // Create summary report
    const report: ReportSummary = {
      status: result.status,
      duration,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalTests: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      skipped: stats.skipped,
      flaky: stats.flaky,
      timedOut: stats.timedOut,
      tests: this.results,
      errors: this.errors,
      warnings: this.detectWarnings(),
      suggestions,
    };

    // Save detailed report
    const reportPath = path.join('test-results', `coldcopy-report-${Date.now()}.json`);
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n===================================');
    console.log('📊 ColdCopy Test Summary');
    console.log('===================================\n');
    console.log(`Status: ${result.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`\nTests:`);
    console.log(`  Total:   ${stats.total}`);
    console.log(`  ✅ Passed: ${stats.passed}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  🔄 Flaky:  ${stats.flaky}`);
    console.log(`  ⏱️  Timeout: ${stats.timedOut}`);

    if (stats.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter((r) => r.status === 'failed')
        .forEach((test) => {
          console.log(`  - ${test.title}`);
          if (test.error) {
            console.log(`    ${test.error.message}`);
          }
        });
    }

    if (suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      suggestions.forEach((s) => console.log(`  - ${s}`));
    }

    console.log(`\n📄 Detailed report: ${reportPath}\n`);
  }

  private generateSuggestions(stats: any): string[] {
    const suggestions: string[] = [];

    // Performance suggestions
    const slowTests = this.results.filter((r) => r.duration > 30000);
    if (slowTests.length > 0) {
      suggestions.push(
        `${slowTests.length} tests took over 30s. Consider optimizing or splitting them.`
      );
    }

    // Flaky test suggestions
    if (stats.flaky > 2) {
      suggestions.push(
        'Multiple flaky tests detected. Review test stability and add better wait conditions.'
      );
    }

    // Timeout suggestions
    if (stats.timedOut > 0) {
      suggestions.push(
        'Tests are timing out. Consider increasing timeout or optimizing page load times.'
      );
    }

    // Error pattern analysis
    const authErrors = this.errors.filter((e) =>
      e.toLowerCase().includes('auth') || e.toLowerCase().includes('login')
    );
    if (authErrors.length > 0) {
      suggestions.push(
        'Authentication-related failures detected. Check login credentials and session handling.'
      );
    }

    const networkErrors = this.errors.filter((e) =>
      e.toLowerCase().includes('network') || e.toLowerCase().includes('timeout')
    );
    if (networkErrors.length > 0) {
      suggestions.push(
        'Network-related failures detected. Check API availability and network conditions.'
      );
    }

    // Success rate
    const successRate = (stats.passed / stats.total) * 100;
    if (successRate < 80) {
      suggestions.push(
        `Test success rate is ${successRate.toFixed(1)}%. Review failing tests for common patterns.`
      );
    }

    return suggestions;
  }

  private detectWarnings(): string[] {
    const warnings: string[] = [];

    // Check for console errors in test output
    const testsWithConsoleErrors = this.results.filter((r) =>
      r.attachments.some((a) => a.name === 'console-errors')
    );
    if (testsWithConsoleErrors.length > 0) {
      warnings.push(
        `${testsWithConsoleErrors.length} tests have console errors. Check browser console output.`
      );
    }

    // Check for skipped tests
    const skippedTests = this.results.filter((r) => r.status === 'skipped');
    if (skippedTests.length > 5) {
      warnings.push(
        `${skippedTests.length} tests were skipped. Ensure all tests are enabled for full coverage.`
      );
    }

    return warnings;
  }
}