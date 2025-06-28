import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateSyncReport } from '@/lib/integrations/pipedrive/bulk-sync';
import PDFDocument from 'pdfkit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ syncId: string }> }
) {
  const { syncId } = await params;
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get sync job with full details
    const { data: syncJob, error } = await supabase
      .from('pipedrive_sync_jobs')
      .select(`
        *,
        created_by:users!created_by_id (
          id,
          email,
          full_name
        )
      `)
      .eq('id', syncId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !syncJob) {
      return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
    }

    if (!syncJob.result) {
      return NextResponse.json(
        { error: 'No report available for this sync job' },
        { status: 404 }
      );
    }

    const format = request.nextUrl.searchParams.get('format') || 'pdf';

    if (format === 'markdown') {
      // Generate markdown report
      const report = generateSyncReport(syncJob.result);
      
      return new Response(report, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="pipedrive-sync-report-${syncId}.md"`,
        },
      });
    }

    // Generate PDF report
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="pipedrive-sync-report-${syncId}.pdf"`,
        },
      });
    });

    // Build PDF content
    doc.fontSize(20).text('Pipedrive Bulk Sync Report', { align: 'center' });
    doc.moveDown();

    // Sync Information
    doc.fontSize(14).text('Sync Information', { underline: true });
    doc.fontSize(10);
    doc.text(`Sync ID: ${syncJob.id}`);
    doc.text(`Status: ${syncJob.status}`);
    doc.text(`Started: ${new Date(syncJob.started_at).toLocaleString()}`);
    doc.text(`Completed: ${syncJob.completed_at ? new Date(syncJob.completed_at).toLocaleString() : 'N/A'}`);
    doc.text(`Created By: ${syncJob.created_by.full_name || syncJob.created_by.email}`);
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Records: ${syncJob.total_records}`);
    doc.text(`Processed: ${syncJob.processed_records}`);
    doc.text(`Successful: ${syncJob.successful_records}`);
    doc.text(`Failed: ${syncJob.failed_records}`);
    doc.text(`Duplicates: ${syncJob.duplicate_records}`);
    doc.text(`Success Rate: ${Math.round((syncJob.successful_records / syncJob.total_records) * 100)}%`);
    doc.moveDown();

    // Detailed Results
    if (syncJob.result?.entities) {
      doc.fontSize(14).text('Detailed Results', { underline: true });
      doc.fontSize(10);

      Object.entries(syncJob.result.entities).forEach(([entityType, entities]: [string, any[]]) => {
        if (entities.length > 0) {
          doc.moveDown();
          doc.fontSize(12).text(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)}:`);
          doc.fontSize(10);
          
          const stats = {
            created: entities.filter((e: any) => e.status === 'created').length,
            updated: entities.filter((e: any) => e.status === 'updated').length,
            skipped: entities.filter((e: any) => e.status === 'skipped').length,
            failed: entities.filter((e: any) => e.status === 'failed').length,
          };
          
          doc.text(`  Created: ${stats.created}`);
          doc.text(`  Updated: ${stats.updated}`);
          doc.text(`  Skipped: ${stats.skipped}`);
          doc.text(`  Failed: ${stats.failed}`);
        }
      });
    }

    // Errors
    if (syncJob.result?.errors?.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Errors', { underline: true });
      doc.fontSize(10);
      
      syncJob.result.errors.slice(0, 50).forEach((error: any, index: number) => {
        doc.text(`${index + 1}. ${error.error}`);
        if (error.entityId) {
          doc.text(`   Entity ID: ${error.entityId}`, { indent: 20 });
        }
      });
      
      if (syncJob.result.errors.length > 50) {
        doc.text(`... and ${syncJob.result.errors.length - 50} more errors`);
      }
    }

    doc.end();

    // Wait for PDF generation to complete
    return new Promise<Response>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new Response(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="pipedrive-sync-report-${syncId}.pdf"`,
            },
          })
        );
      });
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
