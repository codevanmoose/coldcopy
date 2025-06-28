import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage/spaces';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import sharp from 'sharp';
import { Readable } from 'stream';

const uploadSchema = z.object({
  type: z.enum(['avatar', 'logo', 'attachment', 'import', 'template', 'export']),
  workspaceId: z.string().uuid().optional(),
});

const MAX_FILE_SIZES = {
  avatar: 5 * 1024 * 1024, // 5MB
  logo: 10 * 1024 * 1024, // 10MB
  attachment: 25 * 1024 * 1024, // 25MB
  import: 100 * 1024 * 1024, // 100MB
  template: 50 * 1024 * 1024, // 50MB
  export: 500 * 1024 * 1024, // 500MB
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const workspaceId = formData.get('workspaceId') as string;

    // Validate input
    const validation = uploadSchema.safeParse({ type, workspaceId });
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { type: fileType } = validation.data;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZES[fileType]) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZES[fileType] / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const validationResult = storage.validateFile(fileType, {
      size: file.size,
      type: file.type,
    });

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Check workspace permissions if workspace-specific upload
    if (workspaceId) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .single();

      if (!member) {
        return NextResponse.json(
          { error: 'Not a member of this workspace' },
          { status: 403 }
        );
      }

      // Check specific permissions based on file type
      if (fileType === 'logo' && !['workspace_admin', 'campaign_manager'].includes(member.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions to upload workspace logo' },
          { status: 403 }
        );
      }
    }

    // Generate unique key
    const key = storage.generateKey(
      getKeyPrefix(fileType, user.id, workspaceId),
      file.name
    );

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process image files
    const uploadResults = [];
    
    if (['avatar', 'logo'].includes(fileType) && file.type.startsWith('image/')) {
      // Generate optimized versions
      const sizes = fileType === 'avatar' ? [200, 400] : [300, 600];
      
      for (const size of sizes) {
        try {
          const resized = await sharp(buffer)
            .resize(size, size, { 
              fit: 'cover',
              position: 'center'
            })
            .webp({ quality: 85 })
            .toBuffer();
          
          const sizedKey = key.replace(/\.[^.]+$/, `-${size}.webp`);
          const result = await storage.uploadFile(
            fileType,
            sizedKey,
            resized,
            {
              metadata: {
                originalName: file.name,
                userId: user.id,
                workspaceId: workspaceId || '',
                variant: `${size}x${size}`,
              },
              contentType: 'image/webp',
              cacheControl: 'public, max-age=86400', // 1 day
            }
          );
          
          uploadResults.push({
            key: sizedKey,
            url: result.url,
            size: size,
          });
        } catch (error) {
          console.error(`Failed to create ${size}px variant:`, error);
        }
      }

      // Also generate a thumbnail
      try {
        const thumbnail = await sharp(buffer)
          .resize(100, 100, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();
        
        const thumbKey = key.replace(/\.[^.]+$/, '-thumb.webp');
        const thumbResult = await storage.uploadFile(
          fileType,
          thumbKey,
          thumbnail,
          {
            metadata: {
              originalName: file.name,
              userId: user.id,
              workspaceId: workspaceId || '',
              variant: 'thumbnail',
            },
            contentType: 'image/webp',
            cacheControl: 'public, max-age=86400',
          }
        );
        
        uploadResults.push({
          key: thumbKey,
          url: thumbResult.url,
          size: 100,
          isThumbnail: true,
        });
      } catch (error) {
        console.error('Failed to create thumbnail:', error);
      }
    }

    // Upload original file
    const result = await storage.uploadFile(
      fileType,
      key,
      buffer,
      {
        metadata: {
          originalName: file.name,
          userId: user.id,
          workspaceId: workspaceId || '',
          contentType: file.type,
        },
        contentType: file.type,
      }
    );

    // Save to database
    const { data: uploadRecord, error: dbError } = await supabase
      .from('uploads')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: fileType,
        filename: file.name,
        path: key,
        size: file.size,
        mime_type: file.type,
        url: result.url,
        metadata: {
          etag: result.etag,
          bucket: result.bucket,
          variants: uploadResults,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded files
      try {
        await storage.deleteFile(result.bucket as any, key);
        for (const variant of uploadResults) {
          await storage.deleteFile(result.bucket as any, variant.key);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      return NextResponse.json(
        { error: 'Failed to save upload record' },
        { status: 500 }
      );
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'file.upload',
      resource_type: 'upload',
      resource_id: uploadRecord.id,
      metadata: {
        fileType,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
      },
    });

    return NextResponse.json({
      success: true,
      upload: {
        id: uploadRecord.id,
        url: result.url,
        path: key,
        size: file.size,
        type: file.type,
        filename: file.name,
        variants: uploadResults,
        createdAt: uploadRecord.created_at,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// GET endpoint for signed URLs
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('id');
    const action = searchParams.get('action') || 'download';
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600');

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID required' },
        { status: 400 }
      );
    }

    // Get upload record
    const { data: upload, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (upload.workspace_id) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', upload.workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!member) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    } else if (upload.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Determine bucket based on file type
    const bucketMap: Record<string, 'uploads' | 'assets' | 'exports' | 'backups'> = {
      avatar: 'uploads',
      logo: 'uploads',
      attachment: 'uploads',
      import: 'uploads',
      template: 'assets',
      export: 'exports',
    };

    const bucket = bucketMap[upload.type] || 'uploads';

    // Generate signed URL
    const signedUrl = await storage.getSignedUrl(
      bucket,
      upload.path,
      expiresIn,
      action === 'download' ? {
        contentDisposition: `attachment; filename="${upload.filename}"`,
      } : undefined
    );

    // Log audit event for sensitive files
    if (['export', 'import'].includes(upload.type)) {
      await supabase.from('audit_logs').insert({
        workspace_id: upload.workspace_id,
        user_id: user.id,
        action: 'file.access',
        resource_type: 'upload',
        resource_id: upload.id,
        metadata: {
          action,
          fileType: upload.type,
          filename: upload.filename,
        },
      });
    }

    return NextResponse.json({
      url: signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}

// DELETE endpoint
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID required' },
        { status: 400 }
      );
    }

    // Get upload record
    const { data: upload, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (upload.workspace_id) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', upload.workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!member || !['workspace_admin', 'campaign_manager'].includes(member.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    } else if (upload.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Determine bucket
    const bucketMap: Record<string, 'uploads' | 'assets' | 'exports' | 'backups'> = {
      avatar: 'uploads',
      logo: 'uploads',
      attachment: 'uploads',
      import: 'uploads',
      template: 'assets',
      export: 'exports',
    };

    const bucket = bucketMap[upload.type] || 'uploads';

    // Delete file from storage
    await storage.deleteFile(bucket, upload.path);

    // Delete variants if any
    if (upload.metadata?.variants) {
      for (const variant of upload.metadata.variants) {
        try {
          await storage.deleteFile(bucket, variant.key);
        } catch (error) {
          console.error('Failed to delete variant:', variant.key, error);
        }
      }
    }

    // Delete database record
    await supabase
      .from('uploads')
      .delete()
      .eq('id', uploadId);

    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: upload.workspace_id,
      user_id: user.id,
      action: 'file.delete',
      resource_type: 'upload',
      resource_id: upload.id,
      metadata: {
        fileType: upload.type,
        filename: upload.filename,
        size: upload.size,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

function getKeyPrefix(fileType: string, userId: string, workspaceId?: string): string {
  switch (fileType) {
    case 'avatar':
      return `users/${userId}/avatars`;
    case 'logo':
      return `workspaces/${workspaceId}/logos`;
    case 'attachment':
      return `workspaces/${workspaceId}/attachments`;
    case 'import':
      return `workspaces/${workspaceId}/imports`;
    case 'template':
      return `workspaces/${workspaceId}/templates`;
    case 'export':
      return `workspaces/${workspaceId}/exports`;
    default:
      return `temp/${userId}`;
  }
}