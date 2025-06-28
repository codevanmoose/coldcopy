'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { EnhancedTooltip } from '@/components/ui/enhanced-tooltip'
import { EnhancedBreadcrumb } from '@/components/ui/enhanced-breadcrumb'
import { 
  LoadingSpinner, 
  LoadingButton, 
  CardSkeleton, 
  TableSkeleton,
  EmptyState,
  ErrorState,
  ProgressBar 
} from '@/components/ui/loading-states'
import { useRegisterShortcut, formatShortcutKeys, useShortcuts } from '@/lib/shortcuts/shortcut-provider'
import { Badge } from '@/components/ui/badge'
import { 
  Palette, 
  Zap, 
  Keyboard, 
  Search,
  MousePointer,
  Smartphone,
  Loader,
  Command,
  Eye,
  Moon,
  Sun,
  Plus,
  Settings,
  Home,
  Users,
  Mail,
  BarChart3,
  Bell,
  Play
} from 'lucide-react'
import { toast } from 'sonner'

export default function UIDemo() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(65)
  const { setCommandPaletteOpen, shortcuts } = useShortcuts()

  // Register demo-specific shortcuts
  useRegisterShortcut({
    id: 'demo-toast',
    keys: ['t'],
    description: 'Show demo toast',
    category: 'Demo',
    action: () => toast.success('Demo toast triggered via keyboard!')
  })

  const handleLoadingDemo = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
    toast.success('Loading demo completed!')
  }

  const triggerToast = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        toast.success('This is a success message!')
        break
      case 'error':
        toast.error('This is an error message!')
        break
      case 'info':
        toast.info('This is an info message!')
        break
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">UI/UX Demo</h1>
          <p className="text-muted-foreground mt-2">
            Showcase of enhanced UI components, dark mode, shortcuts, and loading states
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button onClick={() => setCommandPaletteOpen(true)}>
            <Command className="h-4 w-4 mr-2" />
            Command Palette
          </Button>
        </div>
      </div>

      {/* Breadcrumb Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MousePointer className="h-5 w-5 mr-2" />
            Enhanced Breadcrumb Navigation
          </CardTitle>
          <CardDescription>
            Intelligent breadcrumb with automatic path generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Current Page Breadcrumb</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <EnhancedBreadcrumb />
              </div>
            </div>
            <div>
              <Label>Custom Breadcrumb</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <EnhancedBreadcrumb 
                  items={[
                    { label: 'Projects', href: '/projects' },
                    { label: 'ColdCopy', href: '/projects/coldcopy' },
                    { label: 'Settings', current: true }
                  ]}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme and Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            Theme System
          </CardTitle>
          <CardDescription>
            Light, dark, and system theme support with smooth transitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <Sun className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <h3 className="font-medium">Light Mode</h3>
              <p className="text-sm text-muted-foreground">Bright and clean interface</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Moon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <h3 className="font-medium">Dark Mode</h3>
              <p className="text-sm text-muted-foreground">Easy on the eyes</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Eye className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <h3 className="font-medium">System</h3>
              <p className="text-sm text-muted-foreground">Follows OS preference</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="shortcuts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shortcuts">
            <Keyboard className="h-4 w-4 mr-2" />
            Shortcuts
          </TabsTrigger>
          <TabsTrigger value="loading">
            <Loader className="h-4 w-4 mr-2" />
            Loading States
          </TabsTrigger>
          <TabsTrigger value="tooltips">
            <MousePointer className="h-4 w-4 mr-2" />
            Tooltips
          </TabsTrigger>
          <TabsTrigger value="responsive">
            <Smartphone className="h-4 w-4 mr-2" />
            Responsive
          </TabsTrigger>
        </TabsList>

        {/* Keyboard Shortcuts Tab */}
        <TabsContent value="shortcuts">
          <Card>
            <CardHeader>
              <CardTitle>Keyboard Shortcuts System</CardTitle>
              <CardDescription>
                Global shortcuts, command palette, and contextual hotkeys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Try These Shortcuts</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Open Command Palette</span>
                      <Badge variant="outline">
                        {formatShortcutKeys(['cmd', 'k'])}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Demo Toast</span>
                      <Badge variant="outline">T</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Search</span>
                      <Badge variant="outline">/</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Help</span>
                      <Badge variant="outline">?</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Navigation Shortcuts</h3>
                  <div className="grid gap-2">
                    {[
                      { label: 'Dashboard', shortcut: ['g', 'h'], icon: Home },
                      { label: 'Leads', shortcut: ['g', 'l'], icon: Users },
                      { label: 'Campaigns', shortcut: ['g', 'c'], icon: Mail },
                      { label: 'Analytics', shortcut: ['g', 'a'], icon: BarChart3 }
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-2 text-sm">
                        <div className="flex items-center">
                          <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{item.label}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatShortcutKeys(item.shortcut)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loading States Tab */}
        <TabsContent value="loading">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Loading Components</CardTitle>
                <CardDescription>
                  Various loading states and skeleton screens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Loading Spinners</Label>
                  <div className="flex items-center space-x-4 mt-2">
                    <LoadingSpinner size="sm" />
                    <LoadingSpinner size="md" />
                    <LoadingSpinner size="lg" />
                  </div>
                </div>

                <div>
                  <Label>Progress Bar</Label>
                  <div className="mt-2">
                    <ProgressBar value={progress} showPercentage />
                    <div className="flex space-x-2 mt-2">
                      <Button 
                        size="sm" 
                        onClick={() => setProgress(Math.max(0, progress - 10))}
                      >
                        -10%
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setProgress(Math.min(100, progress + 10))}
                      >
                        +10%
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Loading Button</Label>
                  <div className="mt-2">
                    <LoadingButton 
                      loading={loading} 
                      onClick={handleLoadingDemo}
                    >
                      {loading ? 'Loading...' : 'Start Demo'}
                    </LoadingButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeleton Screens</CardTitle>
                <CardDescription>
                  Placeholder content while loading
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Card Skeleton</Label>
                  <div className="mt-2">
                    <CardSkeleton />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Empty and Error States</CardTitle>
                <CardDescription>
                  User-friendly states for different scenarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <EmptyState
                    icon={<Plus className="h-6 w-6" />}
                    title="No items found"
                    description="Get started by creating your first item"
                    action={
                      <Button onClick={() => toast.info('Create action triggered!')}>
                        Create Item
                      </Button>
                    }
                  />
                  <ErrorState
                    description="Failed to load data. Please try again."
                    retry={() => toast.info('Retry action triggered!')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Enhanced Tooltips Tab */}
        <TabsContent value="tooltips">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Tooltips</CardTitle>
              <CardDescription>
                Tooltips with keyboard shortcut support and better positioning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EnhancedTooltip content="Navigate to dashboard" shortcut={['g', 'h']}>
                  <Button variant="outline" className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </EnhancedTooltip>

                <EnhancedTooltip content="Open command palette" shortcut={['cmd', 'k']}>
                  <Button variant="outline" className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </EnhancedTooltip>

                <EnhancedTooltip content="Show notifications" shortcut={['shift', 'n']}>
                  <Button variant="outline" className="w-full">
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </Button>
                </EnhancedTooltip>

                <EnhancedTooltip content="Open settings" shortcut={['g', 's']}>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </EnhancedTooltip>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responsive Design Tab */}
        <TabsContent value="responsive">
          <Card>
            <CardHeader>
              <CardTitle>Responsive Design</CardTitle>
              <CardDescription>
                Components that adapt to different screen sizes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Responsive Grid</h3>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="card-interactive">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">Feature {i + 1}</h4>
                              <p className="text-sm text-muted-foreground">
                                Description for feature {i + 1}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Responsive Form</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="demo-input-1">First Name</Label>
                      <Input id="demo-input-1" placeholder="Enter first name" />
                    </div>
                    <div>
                      <Label htmlFor="demo-input-2">Last Name</Label>
                      <Input id="demo-input-2" placeholder="Enter last name" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="demo-input-3">Email</Label>
                      <Input id="demo-input-3" type="email" placeholder="Enter email address" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Toast Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Toast Notifications</CardTitle>
          <CardDescription>
            Contextual notifications with proper theming
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => triggerToast('success')}
            >
              Success Toast
            </Button>
            <Button 
              variant="outline" 
              onClick={() => triggerToast('error')}
            >
              Error Toast
            </Button>
            <Button 
              variant="outline" 
              onClick={() => triggerToast('info')}
            >
              Info Toast
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}