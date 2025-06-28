'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

export default function UploadsPage() {
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [logoUrl, setLogoUrl] = useState<string>();
  const { toast } = useToast();

  const handleUploadComplete = (type: string) => (file: any) => {
    console.log(`${type} uploaded:`, file);
    toast({
      title: `${type} uploaded successfully`,
      description: `File: ${file.filename} (${formatFileSize(file.size)})`,
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">File Uploads</h1>
        <p className="text-gray-600 mt-2">
          Manage your files and uploads with Digital Ocean Spaces integration
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Upload a profile picture that represents you across the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-6">
                <AvatarUpload
                  currentAvatarUrl={avatarUrl}
                  onUploadComplete={setAvatarUrl}
                  size="xl"
                />
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Recommended: Square image, at least 400x400px
                  </p>
                  <p className="text-sm text-gray-600">
                    Max file size: 5MB
                  </p>
                  <p className="text-sm text-gray-600">
                    Supported formats: JPG, PNG, WebP, GIF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Logo</CardTitle>
              <CardDescription>
                Upload your company or workspace logo for branding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                fileType="logo"
                workspaceId="your-workspace-id" // Replace with actual workspace ID
                onUploadComplete={handleUploadComplete('Logo')}
                accept={{
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
                }}
              />
              {logoUrl && (
                <div className="mt-4">
                  <img
                    src={logoUrl}
                    alt="Workspace logo"
                    className="max-w-xs rounded-lg border"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Data</CardTitle>
              <CardDescription>
                Upload CSV or Excel files to import leads or other data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                fileType="import"
                workspaceId="your-workspace-id"
                onUploadComplete={handleUploadComplete('Import file')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Attachments</CardTitle>
              <CardDescription>
                Upload files to attach to your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                fileType="attachment"
                workspaceId="your-workspace-id"
                onUploadComplete={handleUploadComplete('Attachment')}
                multiple
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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