# 🛠️ ColdCopy Enhanced Development Tools

This directory contains advanced tools that enhance Claude Code's capabilities for monitoring, testing, and maintaining the ColdCopy production deployment.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm run setup:tools
   ```

2. **Run production diagnostics:**
   ```bash
   npm run diagnose
   ```

3. **Start continuous monitoring:**
   ```bash
   npm run monitor
   ```

## 📦 Available Tools

### 1. Browser Controller (`browser-controller.ts`)
Automated browser testing using Playwright for production verification.

**Features:**
- Screenshot capture with annotations
- Page state extraction
- Error detection
- Visual regression testing
- Dashboard navigation

**Usage:**
```typescript
import { BrowserController } from './tools/browser-controller';

const controller = new BrowserController();
await controller.initialize({ headless: true });
const results = await controller.testColdCopyProduction();
await controller.cleanup();
```

### 2. Visual Analyzer (`visual-analyzer.ts`)
AI-powered screenshot analysis and visual regression testing.

**Features:**
- OCR text extraction
- Error/warning detection
- UI element identification
- Visual diff comparison
- Automated reporting

**Usage:**
```typescript
import { VisualAnalyzer } from './tools/visual-analyzer';

const analyzer = new VisualAnalyzer();
const analysis = await analyzer.analyzeScreenshot('screenshot.png');
const comparison = await analyzer.compareScreenshots('current.png', 'baseline.png');
```

### 3. Deployment Diagnostics (`diagnose-deployment.js`)
Comprehensive health check for production deployment.

**Features:**
- Frontend availability check
- API endpoint testing
- Database connectivity
- AI service configuration
- Environment variable validation

**Usage:**
```bash
npm run diagnose
```

### 4. Production Monitor (`monitor-production.ts`)
Continuous monitoring service for production health.

**Features:**
- Scheduled health checks
- Performance metrics
- Visual monitoring
- Alert generation
- Comprehensive reporting

**Usage:**
```bash
# Default: 5-minute intervals
npm run monitor

# Custom interval (seconds)
npm run monitor -- https://coldcopy.cc 300
```

## 📋 NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run test:prod` | Run production E2E tests |
| `npm run diagnose` | Run deployment diagnostics |
| `npm run monitor` | Start continuous monitoring |
| `npm run test:all` | Run complete test suite |
| `npm run verify:full` | Full deployment verification |
| `npm run setup:tools` | Install tool dependencies |

## 🧪 Production Testing

### Complete Test Suite
Run all production tests with a single command:
```bash
npm run test:all
```

This will:
1. Run deployment diagnostics
2. Execute E2E tests
3. Check API health
4. Measure performance
5. Verify security headers
6. Generate comprehensive report

### Individual Tests
```bash
# E2E tests only
npm run test:prod

# API health checks
curl https://coldcopy.cc/api/health
curl https://coldcopy.cc/api/test-ai-config
curl https://coldcopy.cc/api/ses-status

# Performance test
curl -o /dev/null -s -w "%{time_total}" https://coldcopy.cc
```

## 📊 Reports

All tools generate detailed reports in the `reports/` directory:

```
reports/
├── production-test-20241228_143022/
│   ├── summary.json
│   ├── diagnostics.log
│   ├── e2e-tests.log
│   ├── api-health.json
│   ├── performance.json
│   └── headers.txt
├── visual/
│   ├── visual-report-*.json
│   └── diff-*.png
├── monitoring-session-*.json
└── alerts/
    └── alert-*.json
```

## 🚨 Alerts and Monitoring

The monitoring system will generate alerts for:
- HTTP status != 200
- API failures
- Visual errors detected
- Performance degradation (>3s load time)
- Critical issues in screenshots

Alerts are saved to `reports/alerts/` and logged to console.

## 🔧 Configuration

### Browser Controller Options
```typescript
{
  headless: boolean,    // Run browser in headless mode
  record: boolean,      // Record videos of sessions
  viewport: {           // Browser viewport size
    width: 1920,
    height: 1080
  }
}
```

### Monitor Configuration
```typescript
{
  url: string,                    // URL to monitor
  checkInterval: number,          // Ms between checks
  screenshots: boolean,           // Capture screenshots
  visualAnalysis: boolean,        // Run visual analysis
  apiTests: boolean,              // Test API endpoints
  performanceMetrics: boolean     // Collect performance data
}
```

## 🤖 Using with Claude Code

These tools are designed to give Claude Code enhanced capabilities:

1. **Visual Feedback**: Claude can "see" the application through screenshots
2. **Production Awareness**: Real-time production health monitoring
3. **Error Detection**: Automatic identification of issues
4. **Performance Tracking**: Continuous performance monitoring

### Example Claude Code Commands

```bash
# "Check if production is healthy"
npm run diagnose

# "Monitor production for 1 hour"
npm run monitor

# "Run full production test suite"
npm run test:all

# "Show me what the landing page looks like"
npm run test:prod -- --grep "Landing Page"
```

## 🐛 Troubleshooting

### Common Issues

1. **Playwright not installed**
   ```bash
   npx playwright install
   ```

2. **Permission denied for scripts**
   ```bash
   chmod +x scripts/*.sh
   ```

3. **TypeScript errors**
   ```bash
   npm install -D ts-node typescript @types/node
   ```

4. **OCR not working**
   ```bash
   npm install tesseract.js
   ```

### Debug Mode

Set environment variables for verbose output:
```bash
DEBUG=* npm run monitor
PWDEBUG=1 npm run test:prod
```

## 🔮 Future Enhancements

- [ ] Slack/Discord integration for alerts
- [ ] Historical trend analysis
- [ ] Automated baseline updates
- [ ] Mobile device testing
- [ ] Load testing integration
- [ ] AI-powered issue resolution suggestions

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Tesseract.js Guide](https://tesseract.projectnaptha.com/)
- [ColdCopy Documentation](https://coldcopy.cc/docs)

---

**Note**: These tools significantly enhance Claude Code's ability to monitor and maintain production deployments. Use them regularly to ensure optimal performance and catch issues early.