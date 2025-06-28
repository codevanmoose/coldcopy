'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

export type FileType = 'avatar' | 'logo' | 'attachment' | 'import' | 'template' | 'export';

interface FileUploadProps {
  fileType: FileType;
  workspaceId?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  onError?: (error: Error) => void;
  maxSize?: number;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  id: string;
  url: string;
  path: string;
  size: number;
  type: string;
  filename: string;
  variants?: Array<{
    key: string;
    url: string;
    size: number;
    isThumbnail?: boolean;
  }>;
  createdAt: string;
}

const DEFAULT_MAX_SIZES: Record<FileType, number> = {
  avatar: 5 * 1024 * 1024, // 5MB
  logo: 10 * 1024 * 1024, // 10MB
  attachment: 25 * 1024 * 1024, // 25MB
  import: 100 * 1024 * 1024, // 100MB
  template: 50 * 1024 * 1024, // 50MB
  export: 500 * 1024 * 1024, // 500MB
};

const DEFAULT_ACCEPT: Record<FileType, Record<string, string[]>> = {
  avatar: {
    'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  },
  logo: {
    'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  },
  attachment: {
    '*/*': [],
  },
  import: {
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  },
  template: {
    'text/html': ['.html'],
    'application/json': ['.json'],
  },
  export: {
    '*/*': [],
  },
};

export function FileUpload({
  fileType,
  workspaceId,
  onUploadComplete,
  onError,
  maxSize,
  accept,
  multiple = false,
  className,
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', fileType);
    if (workspaceId) {
      formData.append('workspaceId', workspaceId);
    }

    const xhr = new XMLHttpRequest();

    return new Promise<UploadedFile>((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve(response.upload);
          } else {
            reject(new Error(response.error || 'Upload failed'));
          }
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || uploading) return;

      setUploading(true);
      setUploadProgress(0);

      try {
        const results = [];

        for (const file of acceptedFiles) {
          try {
            const result = await uploadFile(file);
            results.push(result);
            setUploadedFiles((prev) => [...prev, result]);
            
            if (onUploadComplete) {
              onUploadComplete(result);
            }

            toast({
              title: 'Upload successful',
              description: `${file.name} has been uploaded.`,
            });
          } catch (error) {
            console.error('Upload error:', error);
            toast({
              title: 'Upload failed',
              description: error instanceof Error ? error.message : 'Unknown error',
              variant: 'destructive',
            });
            
            if (onError) {
              onError(error instanceof Error ? error : new Error('Upload failed'));
            }
          }
        }
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [disabled, uploading, fileType, workspaceId, onUploadComplete, onError, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept || DEFAULT_ACCEPT[fileType],
    maxSize: maxSize || DEFAULT_MAX_SIZES[fileType],
    multiple,
    disabled: disabled || uploading,
  });

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
          isDragActive && 'border-primary bg-primary/5',
          uploading && 'cursor-not-allowed opacity-50',
          !isDragActive && !uploading && 'border-gray-300 hover:border-gray-400',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-2 w-full max-w-xs">
                <p className="text-sm text-gray-600">Uploading...</p>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-gray-500">{Math.round(uploadProgress)}%</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? 'Drop files here'
                    : 'Drag & drop files here, or click to select'}
                </p>
                <p className="text-xs text-gray-500">
                  Max size: {formatFileSize(maxSize || DEFAULT_MAX_SIZES[fileType])}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Uploaded files:</p>
          {uploadedFiles.map((file, index) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(index)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}