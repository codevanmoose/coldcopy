'use client';

import { useState } from 'react';
import { User, Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUpload } from './file-upload';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onUploadComplete?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  fallback?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
};

export function AvatarUpload({
  currentAvatarUrl,
  onUploadComplete,
  size = 'md',
  editable = true,
  fallback,
  className,
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadComplete = (file: any) => {
    setIsUploading(false);
    
    // Find the best variant for display (prefer 400px for larger sizes)
    const variant = file.variants?.find((v: any) => 
      size === 'lg' || size === 'xl' ? v.size === 400 : v.size === 200
    );
    
    const newUrl = variant?.url || file.url;
    setAvatarUrl(newUrl);
    setIsOpen(false);
    
    if (onUploadComplete) {
      onUploadComplete(newUrl);
    }
  };

  const AvatarComponent = (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={avatarUrl} alt="Avatar" />
      <AvatarFallback>
        {fallback || <User className="h-1/2 w-1/2 text-gray-400" />}
      </AvatarFallback>
    </Avatar>
  );

  if (!editable) {
    return AvatarComponent;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'relative group rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            sizeClasses[size]
          )}
        >
          {AvatarComponent}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-1/3 w-1/3 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Avatar</DialogTitle>
          <DialogDescription>
            Choose a new profile picture. Images will be resized and optimized automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {avatarUrl && (
            <div className="flex justify-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={avatarUrl} alt="Current avatar" />
                <AvatarFallback>
                  <User className="h-16 w-16 text-gray-400" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          
          <FileUpload
            fileType="avatar"
            onUploadComplete={handleUploadComplete}
            onError={() => setIsUploading(false)}
            disabled={isUploading}
            className="w-full"
          />
          
          {avatarUrl && (
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAvatarUrl(undefined);
                  if (onUploadComplete) {
                    onUploadComplete('');
                  }
                }}
                disabled={isUploading}
              >
                Remove Avatar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}