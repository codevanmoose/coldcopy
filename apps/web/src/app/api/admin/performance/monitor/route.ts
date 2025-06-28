import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { performanceMonitor } from '@/lib/performance/monitor';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || !['super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    switch (action) {
      case 'status':
        return getMonitorStatus();
      case 'snapshots':
        return getRecentSnapshots(request);
      case 'alerts':
        return getActiveAlerts();
      case 'trends':
        return getPerformanceTrends(request);
      case 'report':
        return getPerformanceReport(request);
      case 'health':
        return getSystemHealth();
      default:
        return getMonitorStatus();
    }
  } catch (error) {
    console.error('Performance monitor API error:', error);
    return NextResponse.json(
      { error: 'Failed to get performance monitor data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || !['super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { action, intervalMs = 60000 } = await request.json();
    
    switch (action) {
      case 'start':
        performanceMonitor.start(intervalMs);
        return NextResponse.json({
          success: true,
          message: 'Performance monitoring started',
          interval: intervalMs,
        });
        
      case 'stop':
        performanceMonitor.stop();
        return NextResponse.json({
          success: true,
          message: 'Performance monitoring stopped',
        });
        
      case 'resolve-alerts':
        return await resolveAlerts(request);
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Performance monitor action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute performance monitor action' },
      { status: 500 }
    );
  }
}

async function getMonitorStatus() {
  const recentSnapshots = performanceMonitor.getRecentSnapshots(1);
  const activeAlerts = performanceMonitor.getActiveAlerts();
  
  return NextResponse.json({
    isRunning: recentSnapshots.length > 0,
    lastSnapshot: recentSnapshots[0]?.timestamp || null,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter(a => a.type === 'critical').length,
  });
}

async function getRecentSnapshots(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get('count') || '10');
  
  const snapshots = performanceMonitor.getRecentSnapshots(count);
  
  return NextResponse.json({
    snapshots,
    count: snapshots.length,
  });
}

async function getActiveAlerts() {
  const alerts = performanceMonitor.getActiveAlerts();
  
  return NextResponse.json({
    alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter(a => a.type === 'critical').length,
      warning: alerts.filter(a => a.type === 'warning').length,
      error: alerts.filter(a => a.type === 'error').length,
    },
  });
}

async function getPerformanceTrends(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24');
  
  const trends = performanceMonitor.getPerformanceTrends(hours);
  
  return NextResponse.json({
    trends,
    period: `${hours} hours`,
  });
}

async function getPerformanceReport(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24');
  
  const report = performanceMonitor.generatePerformanceReport(hours);
  
  return NextResponse.json({
    report,
    generatedAt: new Date().toISOString(),
  });
}

async function getSystemHealth() {
  const supabase = createClient();
  
  const { data: healthChecks } = await supabase.rpc('check_system_health');
  
  return NextResponse.json({
    healthChecks: healthChecks || [],
    overallStatus: determineOverallStatus(healthChecks || []),
    timestamp: new Date().toISOString(),
  });
}

async function resolveAlerts(request: NextRequest) {
  const { alertIds } = await request.json();
  
  if (!alertIds || !Array.isArray(alertIds)) {
    return NextResponse.json({ error: 'Alert IDs required' }, { status: 400 });
  }
  
  const supabase = createClient();
  
  const { data: result } = await supabase.rpc('resolve_performance_alerts', {
    alert_ids: alertIds
  });
  
  return NextResponse.json({
    success: true,
    resolvedCount: result || 0,
    message: `${result || 0} alerts resolved`,
  });
}

function determineOverallStatus(healthChecks: any[]): 'ok' | 'warning' | 'critical' {
  if (healthChecks.some(check => check.status === 'critical')) {
    return 'critical';
  }
  if (healthChecks.some(check => check.status === 'warning')) {
    return 'warning';
  }
  return 'ok';
}