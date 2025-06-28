import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllQueueMetrics, queues } from '@/lib/queue';

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
    
    if (!profile || !['super_admin', 'workspace_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Get queue metrics
    const metrics = await getAllQueueMetrics();
    
    // Get additional details for each queue
    const detailedMetrics = await Promise.all(
      metrics.map(async (metric) => {
        const queue = queues[metric.name as keyof typeof queues];
        
        // Get sample of waiting jobs
        const waitingJobs = await queue.getWaiting(0, 5);
        const activeJobs = await queue.getActive(0, 5);
        const failedJobs = await queue.getFailed(0, 5);
        
        return {
          ...metric,
          isPaused: await queue.isPaused(),
          waitingSample: waitingJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            timestamp: job.timestamp,
            delay: job.delay,
          })),
          activeSample: activeJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            timestamp: job.timestamp,
            progress: job.progress(),
          })),
          failedSample: failedJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
          })),
        };
      })
    );
    
    return NextResponse.json({
      metrics: detailedMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue metrics' },
      { status: 500 }
    );
  }
}

// Pause/resume queue
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
    
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { queueName, action } = await request.json();
    
    if (!queueName || !action) {
      return NextResponse.json(
        { error: 'Missing queue name or action' },
        { status: 400 }
      );
    }
    
    const queue = queues[queueName as keyof typeof queues];
    if (!queue) {
      return NextResponse.json(
        { error: 'Invalid queue name' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'pause':
        await queue.pause();
        break;
      case 'resume':
        await queue.resume();
        break;
      case 'clean':
        await queue.clean(0, 'completed');
        await queue.clean(86400000, 'failed'); // Clean failed jobs older than 1 day
        break;
      case 'retry-failed':
        const failedJobs = await queue.getFailed();
        await Promise.all(failedJobs.map(job => job.retry()));
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      queue: queueName,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform queue action' },
      { status: 500 }
    );
  }
}