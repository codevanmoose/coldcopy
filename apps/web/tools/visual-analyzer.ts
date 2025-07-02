import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import path from 'path';
import Tesseract from 'tesseract.js';

interface VisualAnalysisResult {
  text: string[];
  errors: string[];
  warnings: string[];
  ui_elements: {
    buttons: string[];
    forms: string[];
    alerts: string[];
  };
  comparison?: {
    different: boolean;
    pixelsDiff: number;
    percentDiff: number;
  };
}

export class VisualAnalyzer {
  private reportsDir: string;
  private baselineDir: string;
  
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'visual');
    this.baselineDir = path.join(process.cwd(), 'tests', 'visual', 'baseline');
  }
  
  async analyzeScreenshot(imagePath: string): Promise<VisualAnalysisResult> {
    console.log(`🔍 Analyzing screenshot: ${imagePath}`);
    
    // Extract text using OCR
    const text = await this.extractText(imagePath);
    
    // Analyze for errors and warnings
    const errors = this.findErrors(text);
    const warnings = this.findWarnings(text);
    
    // Extract UI elements
    const ui_elements = this.extractUIElements(text);
    
    return {
      text,
      errors,
      warnings,
      ui_elements,
    };
  }
  
  async compareScreenshots(
    currentPath: string, 
    baselinePath: string
  ): Promise<VisualAnalysisResult['comparison']> {
    try {
      const [currentImg, baselineImg] = await Promise.all([
        this.loadPNG(currentPath),
        this.loadPNG(baselinePath)
      ]);
      
      if (currentImg.width !== baselineImg.width || currentImg.height !== baselineImg.height) {
        return {
          different: true,
          pixelsDiff: -1,
          percentDiff: 100
        };
      }
      
      const diff = new PNG({ width: currentImg.width, height: currentImg.height });
      const pixelsDiff = pixelmatch(
        currentImg.data,
        baselineImg.data,
        diff.data,
        currentImg.width,
        currentImg.height,
        { threshold: 0.1 }
      );
      
      const totalPixels = currentImg.width * currentImg.height;
      const percentDiff = (pixelsDiff / totalPixels) * 100;
      
      // Save diff image
      const diffPath = path.join(this.reportsDir, `diff-${Date.now()}.png`);
      await fs.mkdir(this.reportsDir, { recursive: true });
      await this.savePNG(diff, diffPath);
      
      return {
        different: pixelsDiff > 0,
        pixelsDiff,
        percentDiff: Math.round(percentDiff * 100) / 100
      };
    } catch (error) {
      console.error('Error comparing screenshots:', error);
      return {
        different: true,
        pixelsDiff: -1,
        percentDiff: 100
      };
    }
  }
  
  async generateVisualReport(analyses: VisualAnalysisResult[]): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      totalScreenshots: analyses.length,
      totalErrors: analyses.reduce((acc, a) => acc + a.errors.length, 0),
      totalWarnings: analyses.reduce((acc, a) => acc + a.warnings.length, 0),
      analyses
    };
    
    const reportPath = path.join(this.reportsDir, `visual-report-${Date.now()}.json`);
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }
  
  private async extractText(imagePath: string): Promise<string[]> {
    try {
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => console.log(m)
      });
      
      return text.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      console.error('OCR error:', error);
      return [];
    }
  }
  
  private findErrors(textLines: string[]): string[] {
    const errorPatterns = [
      /error/i,
      /failed/i,
      /exception/i,
      /cannot/i,
      /unable/i,
      /invalid/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /500\s/,
      /404\s/,
      /403\s/,
      /401\s/
    ];
    
    const errors: string[] = [];
    
    textLines.forEach(line => {
      errorPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          errors.push(line);
        }
      });
    });
    
    return [...new Set(errors)];
  }
  
  private findWarnings(textLines: string[]): string[] {
    const warningPatterns = [
      /warning/i,
      /deprecated/i,
      /alert/i,
      /notice/i,
      /sandbox/i,
      /limited/i,
      /pending/i,
      /waiting/i
    ];
    
    const warnings: string[] = [];
    
    textLines.forEach(line => {
      warningPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          warnings.push(line);
        }
      });
    });
    
    return [...new Set(warnings)];
  }
  
  private extractUIElements(textLines: string[]): VisualAnalysisResult['ui_elements'] {
    const elements = {
      buttons: [] as string[],
      forms: [] as string[],
      alerts: [] as string[]
    };
    
    const buttonPatterns = [
      /^(submit|save|cancel|delete|create|update|send|test|start|stop|continue|next|previous|back)/i,
      /button/i,
      /\bclick\b/i
    ];
    
    const formPatterns = [
      /email/i,
      /password/i,
      /input/i,
      /field/i,
      /form/i,
      /enter\s+your/i
    ];
    
    const alertPatterns = [
      /alert/i,
      /notification/i,
      /message/i,
      /success/i,
      /info/i
    ];
    
    textLines.forEach(line => {
      buttonPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          elements.buttons.push(line);
        }
      });
      
      formPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          elements.forms.push(line);
        }
      });
      
      alertPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          elements.alerts.push(line);
        }
      });
    });
    
    // Remove duplicates
    elements.buttons = [...new Set(elements.buttons)];
    elements.forms = [...new Set(elements.forms)];
    elements.alerts = [...new Set(elements.alerts)];
    
    return elements;
  }
  
  private async loadPNG(filePath: string): Promise<PNG> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath)
        .then(data => {
          const png = PNG.sync.read(data);
          resolve(png);
        })
        .catch(reject);
    });
  }
  
  private async savePNG(png: PNG, filePath: string): Promise<void> {
    const buffer = PNG.sync.write(png);
    await fs.writeFile(filePath, buffer);
  }
  
  async analyzeProductionDeployment(screenshots: string[]): Promise<any> {
    console.log('🔬 Analyzing production deployment screenshots...');
    
    const analyses: VisualAnalysisResult[] = [];
    
    for (const screenshot of screenshots) {
      const analysis = await this.analyzeScreenshot(screenshot);
      
      // Check for baseline comparison
      const screenshotName = path.basename(screenshot);
      const baselinePath = path.join(this.baselineDir, screenshotName.replace(/-\d{4}-.*\.png$/, '.png'));
      
      if (await this.fileExists(baselinePath)) {
        analysis.comparison = await this.compareScreenshots(screenshot, baselinePath);
      }
      
      analyses.push(analysis);
    }
    
    const reportPath = await this.generateVisualReport(analyses);
    
    // Generate summary
    const summary = {
      reportPath,
      totalErrors: analyses.reduce((acc, a) => acc + a.errors.length, 0),
      totalWarnings: analyses.reduce((acc, a) => acc + a.warnings.length, 0),
      visualChanges: analyses.filter(a => a.comparison?.different).length,
      criticalIssues: this.identifyCriticalIssues(analyses)
    };
    
    return summary;
  }
  
  private identifyCriticalIssues(analyses: VisualAnalysisResult[]): string[] {
    const issues: string[] = [];
    
    analyses.forEach((analysis, index) => {
      // Check for error states
      if (analysis.errors.length > 0) {
        issues.push(`Screenshot ${index + 1}: ${analysis.errors.length} errors detected`);
      }
      
      // Check for significant visual changes
      if (analysis.comparison && analysis.comparison.percentDiff > 10) {
        issues.push(`Screenshot ${index + 1}: ${analysis.comparison.percentDiff}% visual difference`);
      }
      
      // Check for missing UI elements
      if (analysis.ui_elements.buttons.length === 0 && analysis.ui_elements.forms.length === 0) {
        issues.push(`Screenshot ${index + 1}: No interactive elements detected`);
      }
    });
    
    return issues;
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}