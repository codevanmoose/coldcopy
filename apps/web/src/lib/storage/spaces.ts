import AWS from 'aws-sdk';
import { Readable } from 'stream';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

// Configure AWS SDK for Digital Ocean Spaces
const spacesEndpoint = new AWS.Endpoint(
  process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com'
);

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY!,
  secretAccessKey: process.env.DO_SPACES_SECRET!,
  region: process.env.DO_SPACES_REGION || 'nyc3',
  signatureVersion: 'v4',
  s3ForcePathStyle: false,
});

// Bucket names
const BUCKETS = {
  uploads: 'coldcopy-uploads',
  assets: 'coldcopy-assets',
  exports: 'coldcopy-exports',
  backups: 'coldcopy-backups',
} as const;

// File type configurations
const FILE_CONFIGS = {
  avatar: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    bucket: 'uploads',
  },
  logo: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    bucket: 'uploads',
  },
  attachment: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: ['*'], // All types allowed
    bucket: 'uploads',
  },
  import: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    bucket: 'uploads',
  },
  template: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['text/html', 'application/json'],
    bucket: 'assets',
  },
  export: {
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedTypes: ['*'],
    bucket: 'exports',
  },
};

export type FileType = keyof typeof FILE_CONFIGS;

export interface UploadOptions {
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  etag?: string;
  versionId?: string;
}

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Upload a file to Spaces
   */
  async uploadFile(
    fileType: FileType,
    key: string,
    body: Buffer | Readable | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const config = FILE_CONFIGS[fileType];
    const bucket = BUCKETS[config.bucket as keyof typeof BUCKETS];

    // Prepare upload parameters
    const params: AWS.S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ServerSideEncryption: 'AES256',
      Metadata: options.metadata || {},
      ContentType: options.contentType || this.getContentType(key),
      CacheControl: options.cacheControl || this.getCacheControl(fileType),
    };

    if (options.contentDisposition) {
      params.ContentDisposition = options.contentDisposition;
    }

    // Add tags if provided
    if (options.tags && Object.keys(options.tags).length > 0) {
      params.Tagging = Object.entries(options.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    }

    // Upload file
    const result = await s3.upload(params).promise();

    return {
      key: result.Key,
      url: result.Location,
      bucket: bucket,
      size: Buffer.isBuffer(body) ? body.length : 0,
      etag: result.ETag,
      versionId: result.VersionId,
    };
  }

  /**
   * Upload file with multipart for large files
   */
  async uploadLargeFile(
    fileType: FileType,
    key: string,
    body: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const config = FILE_CONFIGS[fileType];
    const bucket = BUCKETS[config.bucket as keyof typeof BUCKETS];

    const params: AWS.S3.CreateMultipartUploadRequest = {
      Bucket: bucket,
      Key: key,
      ServerSideEncryption: 'AES256',
      Metadata: options.metadata || {},
      ContentType: options.contentType || this.getContentType(key),
      CacheControl: options.cacheControl || this.getCacheControl(fileType),
    };

    // Use managed upload for automatic multipart handling
    const upload = s3.upload({
      ...params,
      Body: body,
      PartSize: 10 * 1024 * 1024, // 10MB parts
      QueueSize: 4, // Parallel parts
    });

    // Track upload progress
    upload.on('httpUploadProgress', (progress) => {
      console.log(`Upload progress: ${progress.loaded}/${progress.total}`);
    });

    const result = await upload.promise();

    return {
      key: result.Key,
      url: result.Location,
      bucket: bucket,
      size: Buffer.isBuffer(body) ? body.length : 0,
      etag: result.ETag,
      versionId: result.VersionId,
    };
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedUrl(
    bucket: keyof typeof BUCKETS,
    key: string,
    expiresIn: number = 3600,
    responseParams?: {
      contentType?: string;
      contentDisposition?: string;
    }
  ): Promise<string> {
    const params: AWS.S3.GetObjectRequest = {
      Bucket: BUCKETS[bucket],
      Key: key,
    };

    if (responseParams?.contentType) {
      params.ResponseContentType = responseParams.contentType;
    }

    if (responseParams?.contentDisposition) {
      params.ResponseContentDisposition = responseParams.contentDisposition;
    }

    return await s3.getSignedUrlPromise('getObject', {
      ...params,
      Expires: expiresIn,
    });
  }

  /**
   * Get a signed URL for upload
   */
  async getUploadUrl(
    fileType: FileType,
    key: string,
    options: {
      contentType?: string;
      maxSize?: number;
      expiresIn?: number;
    } = {}
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const config = FILE_CONFIGS[fileType];
    const bucket = BUCKETS[config.bucket as keyof typeof BUCKETS];

    const params = {
      Bucket: bucket,
      Key: key,
      Expires: options.expiresIn || 3600,
      ContentType: options.contentType || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    };

    const url = await s3.getSignedUrlPromise('putObject', params);

    return {
      url,
      fields: {
        key,
        'Content-Type': params.ContentType,
        'x-amz-server-side-encryption': params.ServerSideEncryption,
      },
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(bucket: keyof typeof BUCKETS, key: string): Promise<void> {
    await s3.deleteObject({
      Bucket: BUCKETS[bucket],
      Key: key,
    }).promise();
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(
    bucket: keyof typeof BUCKETS,
    keys: string[]
  ): Promise<void> {
    if (keys.length === 0) return;

    const params: AWS.S3.DeleteObjectsRequest = {
      Bucket: BUCKETS[bucket],
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false,
      },
    };

    const result = await s3.deleteObjects(params).promise();

    if (result.Errors && result.Errors.length > 0) {
      console.error('Delete errors:', result.Errors);
      throw new Error(`Failed to delete ${result.Errors.length} files`);
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(
    bucket: keyof typeof BUCKETS,
    prefix: string,
    options: {
      maxKeys?: number;
      continuationToken?: string;
    } = {}
  ): Promise<{
    files: AWS.S3.Object[];
    nextToken?: string;
    isTruncated: boolean;
  }> {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: BUCKETS[bucket],
      Prefix: prefix,
      MaxKeys: options.maxKeys || 1000,
      ContinuationToken: options.continuationToken,
    };

    const result = await s3.listObjectsV2(params).promise();

    return {
      files: result.Contents || [],
      nextToken: result.NextContinuationToken,
      isTruncated: result.IsTruncated || false,
    };
  }

  /**
   * Copy a file
   */
  async copyFile(
    sourceBucket: keyof typeof BUCKETS,
    sourceKey: string,
    destBucket: keyof typeof BUCKETS,
    destKey: string,
    options: {
      metadata?: Record<string, string>;
      metadataDirective?: 'COPY' | 'REPLACE';
    } = {}
  ): Promise<void> {
    const params: AWS.S3.CopyObjectRequest = {
      Bucket: BUCKETS[destBucket],
      Key: destKey,
      CopySource: `${BUCKETS[sourceBucket]}/${sourceKey}`,
      ServerSideEncryption: 'AES256',
      MetadataDirective: options.metadataDirective || 'COPY',
    };

    if (options.metadata && options.metadataDirective === 'REPLACE') {
      params.Metadata = options.metadata;
    }

    await s3.copyObject(params).promise();
  }

  /**
   * Check if file exists
   */
  async fileExists(bucket: keyof typeof BUCKETS, key: string): Promise<boolean> {
    try {
      await s3.headObject({
        Bucket: BUCKETS[bucket],
        Key: key,
      }).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    bucket: keyof typeof BUCKETS,
    key: string
  ): Promise<AWS.S3.HeadObjectOutput> {
    return await s3.headObject({
      Bucket: BUCKETS[bucket],
      Key: key,
    }).promise();
  }

  /**
   * Generate a unique key for a file
   */
  generateKey(
    prefix: string,
    filename: string,
    options: {
      includeTimestamp?: boolean;
      includeRandom?: boolean;
    } = {}
  ): string {
    const ext = filename.split('.').pop() || '';
    const name = filename.replace(`.${ext}`, '');
    const parts = [prefix];

    if (options.includeTimestamp !== false) {
      parts.push(Date.now().toString());
    }

    if (options.includeRandom !== false) {
      parts.push(crypto.randomBytes(8).toString('hex'));
    }

    parts.push(name);

    return `${parts.join('/')}.${ext}`;
  }

  /**
   * Validate file before upload
   */
  validateFile(
    fileType: FileType,
    file: {
      size: number;
      type: string;
    }
  ): { valid: boolean; error?: string } {
    const config = FILE_CONFIGS[fileType];

    // Check size
    if (file.size > config.maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${config.maxSize / 1024 / 1024}MB`,
      };
    }

    // Check type
    if (
      config.allowedTypes[0] !== '*' &&
      !config.allowedTypes.includes(file.type)
    ) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get content type from filename
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const types: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',

      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Text
      txt: 'text/plain',
      csv: 'text/csv',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',

      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',

      // Media
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };

    return types[ext] || 'application/octet-stream';
  }

  /**
   * Get cache control header based on file type
   */
  private getCacheControl(fileType: FileType): string {
    switch (fileType) {
      case 'avatar':
      case 'logo':
        return 'public, max-age=86400'; // 1 day
      case 'template':
        return 'public, max-age=31536000, immutable'; // 1 year
      case 'attachment':
      case 'import':
      case 'export':
        return 'private, no-cache';
      default:
        return 'public, max-age=3600'; // 1 hour
    }
  }
}

// Export singleton instance
export const storage = StorageService.getInstance();