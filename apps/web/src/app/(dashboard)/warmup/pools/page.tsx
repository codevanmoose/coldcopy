"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { 
  Users, Plus, Mail, Shield, Activity, Settings, 
  CheckCircle2, AlertCircle, Lock, Globe, RefreshCw,
  User, Send, Inbox, Eye, EyeOff, TestTube,
  BarChart3, TrendingUp, AlertTriangle, Edit, Trash2
} from "lucide-react"
import { format } from "date-fns"

interface WarmupPool {
  id: string
  name: string
  description?: string
  current_size: number
  target_size: number
  min_engagement_rate: number
  max_engagement_rate: number
  reply_probability: number
  is_active: boolean
  created_at: string
}

interface WarmupAccount {
  id: string
  email: string
  display_name: string
  provider: string
  status: string
  reputation_score: number
  sends_today: number
  max_sends_per_day: number
  total_sent: number
  total_received: number
  last_send_at?: string
  last_error?: string
}

const PROVIDER_ICONS = {
  gmail: <Mail className="w-4 h-4" />,
  outlook: <Globe className="w-4 h-4" />,
  yahoo: <Mail className="w-4 h-4" />,
  custom: <Settings className="w-4 h-4" />,
  amazon_ses: <Send className="w-4 h-4" />
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
  active: { bg: 'bg-green-500', text: 'text-green-500' },
  paused: { bg: 'bg-orange-500', text: 'text-orange-500' },
  failed: { bg: 'bg-red-500', text: 'text-red-500' }
}

export default function WarmupPoolsPage() {
  const [pools, setPools] = useState<WarmupPool[]>([])
  const [selectedPool, setSelectedPool] = useState<WarmupPool | null>(null)
  const [poolAccounts, setPoolAccounts] = useState<WarmupAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false)
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form states
  const [newPool, setNewPool] = useState({
    name: '',
    description: '',
    target_size: 50,
    min_engagement_rate: 30,
    max_engagement_rate: 70,
    reply_probability: 10
  })

  const [newAccount, setNewAccount] = useState({
    email: '',
    display_name: '',
    provider: 'gmail',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    imap_host: '',
    imap_port: 993
  })

  useEffect(() => {
    loadPools()
  }, [])

  useEffect(() => {
    if (selectedPool) {
      loadPoolAccounts(selectedPool.id)
    }
  }, [selectedPool])

  const loadPools = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      // const response = await fetch('/api/warmup/pools')
      // const data = await response.json()
      
      // Mock data
      const mockPools: WarmupPool[] = [
        {
          id: '1',
          name: 'Primary Warm-up Pool',
          description: 'Main pool for warming up sending domains',
          current_size: 45,
          target_size: 50,
          min_engagement_rate: 0.3,
          max_engagement_rate: 0.7,
          reply_probability: 0.1,
          is_active: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          name: 'Secondary Pool',
          description: 'Backup pool for additional capacity',
          current_size: 28,
          target_size: 30,
          min_engagement_rate: 0.4,
          max_engagement_rate: 0.6,
          reply_probability: 0.15,
          is_active: true,
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
      
      setPools(mockPools)
      if (mockPools.length > 0 && !selectedPool) {
        setSelectedPool(mockPools[0])
      }
    } catch (error) {
      toast.error("Failed to load warm-up pools")
    } finally {
      setIsLoading(false)
    }
  }

  const loadPoolAccounts = async (poolId: string) => {
    try {
      // API call would go here
      // const response = await fetch(`/api/warmup/pools/${poolId}/accounts`)
      // const data = await response.json()
      
      // Mock data
      const mockAccounts: WarmupAccount[] = [
        {
          id: '1',
          email: 'warmup1@example.com',
          display_name: 'Warmup Account 1',
          provider: 'gmail',
          status: 'active',
          reputation_score: 85,
          sends_today: 15,
          max_sends_per_day: 50,
          total_sent: 1250,
          total_received: 1180,
          last_send_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          email: 'warmup2@example.com',
          display_name: 'Warmup Account 2',
          provider: 'outlook',
          status: 'active',
          reputation_score: 92,
          sends_today: 22,
          max_sends_per_day: 60,
          total_sent: 1830,
          total_received: 1750,
          last_send_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          email: 'warmup3@example.com',
          display_name: 'Warmup Account 3',
          provider: 'gmail',
          status: 'pending',
          reputation_score: 50,
          sends_today: 0,
          max_sends_per_day: 10,
          total_sent: 0,
          total_received: 0
        }
      ]
      
      setPoolAccounts(mockAccounts)
    } catch (error) {
      toast.error("Failed to load pool accounts")
    }
  }

  const createPool = async () => {
    try {
      // API call would go here
      // const response = await fetch('/api/warmup/pools', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     ...newPool,
      //     min_engagement_rate: newPool.min_engagement_rate / 100,
      //     max_engagement_rate: newPool.max_engagement_rate / 100,
      //     reply_probability: newPool.reply_probability / 100
      //   })
      // })
      
      toast.success("Warm-up pool created successfully")
      setIsCreatePoolOpen(false)
      loadPools()
      
      // Reset form
      setNewPool({
        name: '',
        description: '',
        target_size: 50,
        min_engagement_rate: 30,
        max_engagement_rate: 70,
        reply_probability: 10
      })
    } catch (error) {
      toast.error("Failed to create pool")
    }
  }

  const addAccount = async () => {
    if (!selectedPool) return
    
    try {
      // Set default ports based on provider
      if (newAccount.provider === 'gmail' && !newAccount.smtp_host) {
        newAccount.smtp_host = 'smtp.gmail.com'
        newAccount.imap_host = 'imap.gmail.com'
      } else if (newAccount.provider === 'outlook' && !newAccount.smtp_host) {
        newAccount.smtp_host = 'smtp-mail.outlook.com'
        newAccount.imap_host = 'outlook.office365.com'
      }
      
      // API call would go here
      // const response = await fetch(`/api/warmup/pools/${selectedPool.id}/accounts`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(newAccount)
      // })
      
      toast.success("Account added successfully")
      setIsAddAccountOpen(false)
      loadPoolAccounts(selectedPool.id)
      
      // Reset form
      setNewAccount({
        email: '',
        display_name: '',
        provider: 'gmail',
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        imap_host: '',
        imap_port: 993
      })
    } catch (error) {
      toast.error("Failed to add account")
    }
  }

  const deletePool = async (poolId: string) => {
    if (!confirm("Are you sure you want to delete this pool? All accounts will be removed.")) {
      return
    }
    
    try {
      // API call would go here
      toast.success("Pool deleted successfully")
      loadPools()
    } catch (error) {
      toast.error("Failed to delete pool")
    }
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending
    return (
      <Badge className={`${config.bg} text-white`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Warm-up Pools
          </h1>
          <p className="text-muted-foreground">Manage email account networks for warming</p>
        </div>
        
        <Dialog open={isCreatePoolOpen} onOpenChange={setIsCreatePoolOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Pool
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Warm-up Pool</DialogTitle>
              <DialogDescription>
                Create a new pool of email accounts for warm-up activities
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="pool-name">Pool Name</Label>
                <Input
                  id="pool-name"
                  value={newPool.name}
                  onChange={(e) => setNewPool({ ...newPool, name: e.target.value })}
                  placeholder="e.g., Primary Warm-up Pool"
                />
              </div>
              
              <div>
                <Label htmlFor="pool-description">Description (Optional)</Label>
                <Input
                  id="pool-description"
                  value={newPool.description}
                  onChange={(e) => setNewPool({ ...newPool, description: e.target.value })}
                  placeholder="Brief description of this pool"
                />
              </div>
              
              <div>
                <Label htmlFor="target-size">Target Pool Size</Label>
                <Input
                  id="target-size"
                  type="number"
                  value={newPool.target_size}
                  onChange={(e) => setNewPool({ ...newPool, target_size: parseInt(e.target.value) })}
                  min={10}
                  max={500}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of accounts to maintain in this pool
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Engagement Rate Range</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={newPool.min_engagement_rate}
                    onChange={(e) => setNewPool({ ...newPool, min_engagement_rate: parseInt(e.target.value) })}
                    min={10}
                    max={90}
                    className="w-20"
                  />
                  <span>% to</span>
                  <Input
                    type="number"
                    value={newPool.max_engagement_rate}
                    onChange={(e) => setNewPool({ ...newPool, max_engagement_rate: parseInt(e.target.value) })}
                    min={10}
                    max={90}
                    className="w-20"
                  />
                  <span>%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Percentage of emails that will be opened/clicked
                </p>
              </div>
              
              <div>
                <Label htmlFor="reply-rate">Reply Probability</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="reply-rate"
                    type="number"
                    value={newPool.reply_probability}
                    onChange={(e) => setNewPool({ ...newPool, reply_probability: parseInt(e.target.value) })}
                    min={0}
                    max={50}
                    className="w-20"
                  />
                  <span>%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Percentage of opened emails that will receive replies
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatePoolOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createPool} disabled={!newPool.name}>
                Create Pool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pool List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Warm-up Pools</CardTitle>
              <CardDescription>Select a pool to view details</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {pools.map((pool) => (
                    <div
                      key={pool.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedPool?.id === pool.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedPool(pool)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{pool.name}</h4>
                        <Badge variant={pool.is_active ? "default" : "secondary"}>
                          {pool.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      {pool.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {pool.description}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Accounts</span>
                          <span>{pool.current_size}/{pool.target_size}</span>
                        </div>
                        <Progress 
                          value={(pool.current_size / pool.target_size) * 100} 
                          className="h-2"
                        />
                      </div>
                      
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>{Math.round(pool.min_engagement_rate * 100)}-{Math.round(pool.max_engagement_rate * 100)}% engagement</span>
                        <span>•</span>
                        <span>{Math.round(pool.reply_probability * 100)}% replies</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Pool Details */}
        <div className="lg:col-span-2">
          {selectedPool ? (
            <Tabs defaultValue="accounts" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="accounts">Accounts</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
                
                {selectedPool && (
                  <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Add Account to Pool</DialogTitle>
                        <DialogDescription>
                          Add an email account to the warm-up pool
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newAccount.email}
                              onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                              placeholder="warmup@example.com"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="display-name">Display Name</Label>
                            <Input
                              id="display-name"
                              value={newAccount.display_name}
                              onChange={(e) => setNewAccount({ ...newAccount, display_name: e.target.value })}
                              placeholder="John Doe"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="provider">Email Provider</Label>
                          <Select
                            value={newAccount.provider}
                            onValueChange={(value) => setNewAccount({ ...newAccount, provider: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gmail">Gmail</SelectItem>
                              <SelectItem value="outlook">Outlook</SelectItem>
                              <SelectItem value="yahoo">Yahoo</SelectItem>
                              <SelectItem value="custom">Custom SMTP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-4">
                          <h4 className="font-medium">SMTP Settings</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="smtp-host">SMTP Host</Label>
                              <Input
                                id="smtp-host"
                                value={newAccount.smtp_host}
                                onChange={(e) => setNewAccount({ ...newAccount, smtp_host: e.target.value })}
                                placeholder="smtp.gmail.com"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="smtp-port">SMTP Port</Label>
                              <Input
                                id="smtp-port"
                                type="number"
                                value={newAccount.smtp_port}
                                onChange={(e) => setNewAccount({ ...newAccount, smtp_port: parseInt(e.target.value) })}
                                placeholder="587"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="smtp-username">SMTP Username</Label>
                            <Input
                              id="smtp-username"
                              value={newAccount.smtp_username}
                              onChange={(e) => setNewAccount({ ...newAccount, smtp_username: e.target.value })}
                              placeholder="Usually your email address"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="smtp-password">SMTP Password</Label>
                            <div className="flex gap-2">
                              <Input
                                id="smtp-password"
                                type={showPassword ? "text" : "password"}
                                value={newAccount.smtp_password}
                                onChange={(e) => setNewAccount({ ...newAccount, smtp_password: e.target.value })}
                                placeholder="App-specific password recommended"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-4">
                          <h4 className="font-medium">IMAP Settings</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="imap-host">IMAP Host</Label>
                              <Input
                                id="imap-host"
                                value={newAccount.imap_host}
                                onChange={(e) => setNewAccount({ ...newAccount, imap_host: e.target.value })}
                                placeholder="imap.gmail.com"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="imap-port">IMAP Port</Label>
                              <Input
                                id="imap-port"
                                type="number"
                                value={newAccount.imap_port}
                                onChange={(e) => setNewAccount({ ...newAccount, imap_port: parseInt(e.target.value) })}
                                placeholder="993"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={addAccount}
                          disabled={!newAccount.email || !newAccount.smtp_host || !newAccount.smtp_password}
                        >
                          <TestTube className="w-4 h-4 mr-2" />
                          Test & Add Account
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <TabsContent value="accounts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pool Accounts</CardTitle>
                    <CardDescription>
                      {poolAccounts.length} of {selectedPool.target_size} accounts configured
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {poolAccounts.map((account) => (
                        <div key={account.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {PROVIDER_ICONS[account.provider as keyof typeof PROVIDER_ICONS]}
                              <div>
                                <p className="font-medium">{account.display_name}</p>
                                <p className="text-sm text-muted-foreground">{account.email}</p>
                              </div>
                            </div>
                            {getStatusBadge(account.status)}
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Reputation</p>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{account.reputation_score}</p>
                                <Progress value={account.reputation_score} className="w-16 h-2" />
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-muted-foreground">Today's Sends</p>
                              <p className="font-medium">
                                {account.sends_today}/{account.max_sends_per_day}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-muted-foreground">Total Activity</p>
                              <p className="font-medium">
                                {account.total_sent} sent • {account.total_received} received
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-muted-foreground">Last Active</p>
                              <p className="font-medium">
                                {account.last_send_at 
                                  ? format(new Date(account.last_send_at), 'MMM d, h:mm a')
                                  : 'Never'}
                              </p>
                            </div>
                          </div>
                          
                          {account.last_error && (
                            <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-700">{account.last_error}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {poolAccounts.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No accounts in this pool yet</p>
                          <p className="text-sm">Add accounts to start warming</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pool Settings</CardTitle>
                    <CardDescription>Configure warm-up behavior for this pool</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Pool Status</Label>
                          <Badge variant={selectedPool.is_active ? "default" : "secondary"}>
                            {selectedPool.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Active pools participate in warm-up activities
                        </p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label>Target Pool Size</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-2xl font-bold">{selectedPool.target_size}</span>
                          <span className="text-muted-foreground">accounts</span>
                        </div>
                        <Progress 
                          value={(selectedPool.current_size / selectedPool.target_size) * 100} 
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Currently {selectedPool.current_size} of {selectedPool.target_size} accounts
                        </p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label>Engagement Configuration</Label>
                        <div className="space-y-3 mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Engagement Rate</span>
                            <span className="font-medium">
                              {Math.round(selectedPool.min_engagement_rate * 100)}% - {Math.round(selectedPool.max_engagement_rate * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Reply Probability</span>
                            <span className="font-medium">{Math.round(selectedPool.reply_probability * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label className="text-red-600">Danger Zone</Label>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">
                          Permanently delete this pool and all associated accounts
                        </p>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deletePool(selectedPool.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Pool
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pool Analytics</CardTitle>
                    <CardDescription>Performance metrics for this warm-up pool</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Activity className="w-4 h-4" />
                          <span className="text-sm">Average Reputation</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {poolAccounts.length > 0 
                            ? Math.round(poolAccounts.reduce((sum, a) => sum + a.reputation_score, 0) / poolAccounts.length)
                            : 0}
                        </p>
                        <p className="text-xs text-green-600">+5 this week</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Send className="w-4 h-4" />
                          <span className="text-sm">Emails Sent Today</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {poolAccounts.reduce((sum, a) => sum + a.sends_today, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Capacity: {poolAccounts.reduce((sum, a) => sum + a.max_sends_per_day, 0)}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm">Total Volume</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {poolAccounts.reduce((sum, a) => sum + a.total_sent, 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Lifetime emails sent
                        </p>
                      </div>
                    </div>
                    
                    <Separator className="my-6" />
                    
                    <div>
                      <h4 className="font-medium mb-4">Account Health Distribution</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">Healthy (80+ reputation)</span>
                              <span className="text-sm font-medium">
                                {poolAccounts.filter(a => a.reputation_score >= 80).length} accounts
                              </span>
                            </div>
                            <Progress 
                              value={poolAccounts.length > 0 
                                ? (poolAccounts.filter(a => a.reputation_score >= 80).length / poolAccounts.length) * 100
                                : 0}
                              className="h-2"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">Warning (50-79 reputation)</span>
                              <span className="text-sm font-medium">
                                {poolAccounts.filter(a => a.reputation_score >= 50 && a.reputation_score < 80).length} accounts
                              </span>
                            </div>
                            <Progress 
                              value={poolAccounts.length > 0
                                ? (poolAccounts.filter(a => a.reputation_score >= 50 && a.reputation_score < 80).length / poolAccounts.length) * 100
                                : 0}
                              className="h-2 [&>div]:bg-yellow-500"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">Critical (&lt;50 reputation)</span>
                              <span className="text-sm font-medium">
                                {poolAccounts.filter(a => a.reputation_score < 50).length} accounts
                              </span>
                            </div>
                            <Progress 
                              value={poolAccounts.length > 0
                                ? (poolAccounts.filter(a => a.reputation_score < 50).length / poolAccounts.length) * 100
                                : 0}
                              className="h-2 [&>div]:bg-red-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a pool to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}