# ColdCopy File Storage & CDN Infrastructure

## Overview

ColdCopy uses Digital Ocean Spaces (S3-compatible object storage) for file storage and CDN delivery. This includes user uploads, email attachments, generated reports, and static assets.

## Architecture

### Storage Buckets
1. **coldcopy-uploads** - User-uploaded files (private)
2. **coldcopy-assets** - Static assets and images (public)
3. **coldcopy-exports** - Generated reports and exports (private)
4. **coldcopy-backups** - System backups (private)

### CDN Configuration
- **Primary CDN**: Digital Ocean CDN (included with Spaces)
- **Custom Domain**: cdn.coldcopy.cc
- **Edge Locations**: Global distribution
- **Cache Control**: Intelligent caching rules

## File Organization

### Bucket Structure
```
coldcopy-uploads/
├── workspaces/
│   ├── {workspace-id}/
│   │   ├── logos/
│   │   ├── attachments/
│   │   ├── imports/
│   │   └── documents/
│   └── ...
├── users/
│   ├── {user-id}/
│   │   ├── avatars/
│   │   └── documents/
│   └── ...
└── temp/
    └── {timestamp}/

coldcopy-assets/
├── email-templates/
│   ├── thumbnails/
│   └── assets/
├── brand/
│   ├── logos/
│   └── icons/
└── public/
    ├── images/
    └── documents/

coldcopy-exports/
├── reports/
│   ├── {workspace-id}/
│   │   ├── analytics/
│   │   ├── campaigns/
│   │   └── gdpr/
│   └── ...
└── bulk-exports/
    └── {job-id}/

coldcopy-backups/
├── database/
│   └── {date}/
├── configurations/
└── archives/
```

## Security Configuration

### Access Control
```javascript
// Bucket policies
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadAssets",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::coldcopy-assets/public/*"
    },
    {
      "Sid": "WorkspaceIsolation",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/coldcopy-app"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::coldcopy-uploads/workspaces/${workspace-id}/*",
      "Condition": {
        "StringEquals": {
          "s3:ExistingObjectTag/workspace-id": "${workspace-id}"
        }
      }
    }
  ]
}
```

### CORS Configuration
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": [
        "https://coldcopy.cc",
        "https://*.coldcopy.cc"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Implementation

### Storage Service
```typescript
// lib/storage/spaces.ts
import AWS from 'aws-sdk';
import { Readable } from 'stream';
import crypto from 'crypto';

const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT!);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY!,
  secretAccessKey: process.env.DO_SPACES_SECRET!,
  region: process.env.DO_SPACES_REGION || 'nyc3',
  signatureVersion: 'v4',
});

export class StorageService {
  private buckets = {
    uploads: 'coldcopy-uploads',
    assets: 'coldcopy-assets',
    exports: 'coldcopy-exports',
    backups: 'coldcopy-backups',
  };

  async uploadFile(
    bucket: keyof typeof this.buckets,
    key: string,
    file: Buffer | Readable,
    metadata?: Record<string, string>
  ) {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.buckets[bucket],
      Key: key,
      Body: file,
      Metadata: metadata,
      ServerSideEncryption: 'AES256',
    };

    // Set content type
    const ext = key.split('.').pop()?.toLowerCase();
    if (ext) {
      params.ContentType = this.getContentType(ext);
    }

    // Set cache control for assets
    if (bucket === 'assets') {
      params.CacheControl = 'public, max-age=31536000, immutable';
    }

    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      etag: result.ETag,
      key: result.Key,
    };
  }

  async getSignedUrl(
    bucket: keyof typeof this.buckets,
    key: string,
    expiresIn: number = 3600
  ) {
    const params = {
      Bucket: this.buckets[bucket],
      Key: key,
      Expires: expiresIn,
    };

    return s3.getSignedUrlPromise('getObject', params);
  }

  async deleteFile(bucket: keyof typeof this.buckets, key: string) {
    await s3.deleteObject({
      Bucket: this.buckets[bucket],
      Key: key,
    }).promise();
  }

  async listFiles(
    bucket: keyof typeof this.buckets,
    prefix: string,
    maxKeys: number = 1000
  ) {
    const result = await s3.listObjectsV2({
      Bucket: this.buckets[bucket],
      Prefix: prefix,
      MaxKeys: maxKeys,
    }).promise();

    return result.Contents || [];
  }

  private getContentType(extension: string): string {
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      txt: 'text/plain',
      html: 'text/html',
      json: 'application/json',
    };

    return types[extension] || 'application/octet-stream';
  }
}

export const storage = new StorageService();
```

### File Upload API
```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage/spaces';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import sharp from 'sharp';

const uploadSchema = z.object({
  type: z.enum(['avatar', 'attachment', 'import', 'logo']),
  workspaceId: z.string().uuid().optional(),
});

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
    const { type: fileType } = uploadSchema.parse({ type, workspaceId });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // File size limits
    const maxSizes: Record<string, number> = {
      avatar: 5 * 1024 * 1024, // 5MB
      logo: 10 * 1024 * 1024, // 10MB
      attachment: 25 * 1024 * 1024, // 25MB
      import: 100 * 1024 * 1024, // 100MB
    };

    if (file.size > maxSizes[fileType]) {
      return NextResponse.json(
        { error: `File too large. Max size: ${maxSizes[fileType] / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    
    // Determine path
    let path = '';
    switch (fileType) {
      case 'avatar':
        path = `users/${user.id}/avatars/${filename}`;
        break;
      case 'logo':
        path = `workspaces/${workspaceId}/logos/${filename}`;
        break;
      case 'attachment':
        path = `workspaces/${workspaceId}/attachments/${filename}`;
        break;
      case 'import':
        path = `workspaces/${workspaceId}/imports/${filename}`;
        break;
    }

    // Process image files
    let buffer = Buffer.from(await file.arrayBuffer());
    
    if (['avatar', 'logo'].includes(fileType) && file.type.startsWith('image/')) {
      // Resize and optimize images
      const sizes = fileType === 'avatar' ? [200, 400] : [300, 600];
      
      for (const size of sizes) {
        const resized = await sharp(buffer)
          .resize(size, size, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer();
        
        const sizedPath = path.replace(`.${ext}`, `-${size}.webp`);
        await storage.uploadFile('uploads', sizedPath, resized, {
          originalName: file.name,
          userId: user.id,
          workspaceId: workspaceId || '',
        });
      }
    }

    // Upload original
    const result = await storage.uploadFile('uploads', path, buffer, {
      originalName: file.name,
      userId: user.id,
      workspaceId: workspaceId || '',
      contentType: file.type,
    });

    // Save to database
    await supabase.from('uploads').insert({
      user_id: user.id,
      workspace_id: workspaceId,
      type: fileType,
      filename: file.name,
      path: path,
      size: file.size,
      mime_type: file.type,
      url: result.url,
    });

    return NextResponse.json({
      success: true,
      file: {
        url: result.url,
        path: path,
        size: file.size,
        type: file.type,
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
```

## CDN Configuration

### Custom Domain Setup
```bash
# 1. Add CNAME record in DNS
cdn.coldcopy.cc CNAME coldcopy-assets.nyc3.cdn.digitaloceanspaces.com

# 2. Configure SSL in DO Spaces dashboard
# - Enable CDN
# - Add custom subdomain
# - Let's Encrypt SSL will be auto-configured
```

### Cache Rules
```nginx
# Email template assets - long cache
location ~* ^/email-templates/.*\.(jpg|jpeg|png|gif|webp|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# User uploads - short cache with revalidation
location ~* ^/uploads/.*$ {
    expires 1h;
    add_header Cache-Control "private, must-revalidate";
}

# Generated exports - no cache
location ~* ^/exports/.*$ {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

## Backup Strategy

### Automated Backups
```typescript
// workers/backup-worker.ts
import { maintenanceQueue, JobType } from '../src/lib/queue';
import { storage } from '../src/lib/storage/spaces';
import { createClient } from '../src/lib/supabase/server';
import archiver from 'archiver';

maintenanceQueue.process(JobType.BACKUP_DATA, async (job) => {
  const { type, workspaceId } = job.data;
  
  const timestamp = new Date().toISOString().split('T')[0];
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  switch (type) {
    case 'workspace':
      // Backup all workspace data
      const files = await storage.listFiles('uploads', `workspaces/${workspaceId}/`);
      
      for (const file of files) {
        const data = await storage.getFile('uploads', file.Key!);
        archive.append(data, { name: file.Key! });
      }
      
      // Upload backup
      const backupKey = `workspaces/${workspaceId}/${timestamp}.zip`;
      await storage.uploadFile('backups', backupKey, archive, {
        workspaceId,
        type: 'workspace-backup',
        timestamp,
      });
      
      break;
      
    case 'database':
      // Database backup handled separately
      break;
  }
  
  return { success: true, timestamp };
});
```

### Lifecycle Policies
```javascript
// Spaces lifecycle rules (set via API or dashboard)
{
  "Rules": [
    {
      "ID": "DeleteOldTempFiles",
      "Status": "Enabled",
      "Prefix": "temp/",
      "Expiration": {
        "Days": 1
      }
    },
    {
      "ID": "TransitionOldBackups",
      "Status": "Enabled",
      "Prefix": "backups/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    },
    {
      "ID": "DeleteOldExports",
      "Status": "Enabled",
      "Prefix": "exports/",
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
```

## Performance Optimization

### Image Optimization
```typescript
// lib/storage/image-optimizer.ts
import sharp from 'sharp';

export class ImageOptimizer {
  static async optimizeForWeb(
    buffer: Buffer,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    } = {}
  ) {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'webp',
    } = options;

    let pipeline = sharp(buffer);
    
    // Get metadata
    const metadata = await pipeline.metadata();
    
    // Resize if needed
    if (metadata.width! > maxWidth || metadata.height! > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert format
    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
    }

    return pipeline.toBuffer();
  }

  static async generateThumbnail(
    buffer: Buffer,
    size: number = 200
  ) {
    return sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  static async generateResponsiveImages(
    buffer: Buffer,
    sizes: number[] = [320, 640, 1024, 1920]
  ) {
    const images = await Promise.all(
      sizes.map(async (width) => {
        const optimized = await sharp(buffer)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        
        return { width, buffer: optimized };
      })
    );

    return images;
  }
}
```

### Multipart Upload
```typescript
// For large files
export async function multipartUpload(
  bucket: string,
  key: string,
  file: Buffer | Readable,
  partSize: number = 5 * 1024 * 1024 // 5MB parts
) {
  const multipart = await s3.createMultipartUpload({
    Bucket: bucket,
    Key: key,
    ServerSideEncryption: 'AES256',
  }).promise();

  const uploadId = multipart.UploadId!;
  const parts: AWS.S3.CompletedPart[] = [];

  try {
    // Upload parts
    let partNumber = 1;
    let start = 0;
    
    while (start < file.length) {
      const end = Math.min(start + partSize, file.length);
      const part = file.slice(start, end);
      
      const uploaded = await s3.uploadPart({
        Bucket: bucket,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: part,
      }).promise();
      
      parts.push({
        ETag: uploaded.ETag!,
        PartNumber: partNumber,
      });
      
      start = end;
      partNumber++;
    }

    // Complete upload
    const result = await s3.completeMultipartUpload({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }).promise();

    return result;
  } catch (error) {
    // Abort on error
    await s3.abortMultipartUpload({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }).promise();
    
    throw error;
  }
}
```

## Cost Management

### Storage Costs (Digital Ocean Spaces)
| Storage | Cost |
|---------|------|
| First 250GB | $5/month |
| Additional storage | $0.02/GB |
| Bandwidth | 1TB free, then $0.01/GB |
| PUT requests | $0.005 per 1,000 |
| GET requests | $0.004 per 1,000 |

### Cost Optimization Strategies
1. **Lifecycle Policies** - Auto-delete temporary files
2. **Compression** - Compress before storage
3. **Image Optimization** - WebP format, appropriate sizes
4. **CDN Caching** - Reduce bandwidth costs
5. **Cleanup Jobs** - Regular removal of unused files

### Monthly Cost Estimate
- Storage: 500GB = $10
- Bandwidth: 2TB = $10
- Requests: ~1M = $5
- **Total: ~$25/month**

## Monitoring

### Metrics to Track
```typescript
// lib/monitoring/storage-metrics.ts
export async function collectStorageMetrics() {
  const buckets = ['uploads', 'assets', 'exports', 'backups'];
  const metrics = [];

  for (const bucket of buckets) {
    // Get bucket size
    const objects = await storage.listFiles(bucket as any, '');
    const totalSize = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
    const count = objects.length;

    metrics.push({
      bucket,
      size: totalSize,
      count,
      avgSize: count > 0 ? totalSize / count : 0,
    });
  }

  // Send to monitoring
  await prometheus.gauge('storage_bucket_size', totalSize);
  await prometheus.gauge('storage_object_count', count);

  return metrics;
}
```

### Alerts
- Storage usage > 80% of limit
- Bandwidth usage spike
- Failed uploads > 5% in 5 minutes
- Large file uploads (> 100MB)

## Security Best Practices

1. **Encryption at Rest** - All files encrypted with AES-256
2. **Encryption in Transit** - HTTPS only
3. **Access Control** - Signed URLs for private files
4. **Workspace Isolation** - Files tagged with workspace ID
5. **Audit Logging** - All file operations logged
6. **Virus Scanning** - Scan uploads with ClamAV
7. **Content Validation** - Verify file types and sizes

## Troubleshooting

### Common Issues

1. **Upload Failures**
   - Check file size limits
   - Verify CORS configuration
   - Check network timeouts

2. **Access Denied**
   - Verify bucket policies
   - Check IAM permissions
   - Validate signed URLs

3. **Slow Uploads**
   - Use multipart for large files
   - Check network bandwidth
   - Consider edge locations

4. **High Costs**
   - Review lifecycle policies
   - Check CDN cache hit ratio
   - Audit large files

## Next Steps

1. Create Spaces buckets
2. Configure CDN and custom domain
3. Set up lifecycle policies
4. Implement file upload service
5. Configure monitoring
6. Test file operations
7. Document API usage