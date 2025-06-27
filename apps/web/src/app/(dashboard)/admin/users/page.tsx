"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Search, Plus, MoreVertical, Shield, Ban, Check, X, Filter, Download, Mail, Key, Users, Building } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
  status: 'active' | 'suspended' | 'pending' | 'inactive'
  workspaceId: string
  workspaceName: string
  lastActive: Date
  createdAt: Date
  emailVerified: boolean
  twoFactorEnabled: boolean
  loginCount: number
  ipAddress?: string
  userAgent?: string
}

interface UserStats {
  totalUsers: number
  activeUsers: number
  pendingUsers: number
  suspendedUsers: number
  superAdmins: number
  workspaceAdmins: number
  campaignManagers: number
  outreachSpecialists: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    suspendedUsers: 0,
    superAdmins: 0,
    workspaceAdmins: 0,
    campaignManagers: 0,
    outreachSpecialists: 0
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Mock data - replace with API calls
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: "1",
        email: "admin@coldcopy.ai",
        firstName: "John",
        lastName: "Smith",
        role: "super_admin",
        status: "active",
        workspaceId: "ws-1",
        workspaceName: "ColdCopy HQ",
        lastActive: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 days ago
        emailVerified: true,
        twoFactorEnabled: true,
        loginCount: 245,
        ipAddress: "192.168.1.100",
        userAgent: "Chrome/91.0"
      },
      {
        id: "2",
        email: "sarah.johnson@example.com",
        firstName: "Sarah",
        lastName: "Johnson",
        role: "workspace_admin",
        status: "active",
        workspaceId: "ws-2",
        workspaceName: "TechCorp Solutions",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45), // 45 days ago
        emailVerified: true,
        twoFactorEnabled: false,
        loginCount: 98,
        ipAddress: "10.0.0.5",
        userAgent: "Safari/14.1"
      },
      {
        id: "3",
        email: "mike.wilson@startup.io",
        firstName: "Mike",
        lastName: "Wilson",
        role: "campaign_manager",
        status: "active",
        workspaceId: "ws-3",
        workspaceName: "StartupCo",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
        emailVerified: true,
        twoFactorEnabled: true,
        loginCount: 67,
        ipAddress: "203.0.113.1",
        userAgent: "Chrome/91.0"
      },
      {
        id: "4",
        email: "lisa.chen@agency.com",
        firstName: "Lisa",
        lastName: "Chen",
        role: "outreach_specialist",
        status: "pending",
        workspaceId: "ws-4",
        workspaceName: "Marketing Agency Pro",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
        emailVerified: false,
        twoFactorEnabled: false,
        loginCount: 3,
        ipAddress: "172.16.0.10",
        userAgent: "Firefox/89.0"
      },
      {
        id: "5",
        email: "suspended@example.com",
        firstName: "Bob",
        lastName: "Smith",
        role: "campaign_manager",
        status: "suspended",
        workspaceId: "ws-5",
        workspaceName: "Suspended Workspace",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
        emailVerified: true,
        twoFactorEnabled: false,
        loginCount: 156,
        ipAddress: "198.51.100.5",
        userAgent: "Chrome/90.0"
      }
    ]

    setUsers(mockUsers)
    
    // Calculate stats
    const stats: UserStats = {
      totalUsers: mockUsers.length,
      activeUsers: mockUsers.filter(u => u.status === 'active').length,
      pendingUsers: mockUsers.filter(u => u.status === 'pending').length,
      suspendedUsers: mockUsers.filter(u => u.status === 'suspended').length,
      superAdmins: mockUsers.filter(u => u.role === 'super_admin').length,
      workspaceAdmins: mockUsers.filter(u => u.role === 'workspace_admin').length,
      campaignManagers: mockUsers.filter(u => u.role === 'campaign_manager').length,
      outreachSpecialists: mockUsers.filter(u => u.role === 'outreach_specialist').length
    }
    setStats(stats)
    setIsLoading(false)
  }, [])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.workspaceName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesWorkspace = workspaceFilter === "all" || user.workspaceId === workspaceFilter

    return matchesSearch && matchesRole && matchesStatus && matchesWorkspace
  })

  const handleSuspendUser = async (userId: string) => {
    try {
      // API call would go here
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: 'suspended' as const } : user
      ))
      toast.success("User suspended successfully")
    } catch (error) {
      toast.error("Failed to suspend user")
    }
  }

  const handleActivateUser = async (userId: string) => {
    try {
      // API call would go here
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: 'active' as const } : user
      ))
      toast.success("User activated successfully")
    } catch (error) {
      toast.error("Failed to activate user")
    }
  }

  const handleResendInvite = async (userId: string) => {
    try {
      // API call would go here
      toast.success("Invitation email sent")
    } catch (error) {
      toast.error("Failed to send invitation")
    }
  }

  const handleCreateUser = async (userData: any) => {
    try {
      // API call would go here
      toast.success("User created successfully")
      setShowCreateDialog(false)
    } catch (error) {
      toast.error("Failed to create user")
    }
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      'super_admin': <Badge variant="destructive" className="flex items-center gap-1"><Shield className="w-3 h-3" />Super Admin</Badge>,
      'workspace_admin': <Badge variant="default" className="flex items-center gap-1"><Users className="w-3 h-3" />Admin</Badge>,
      'campaign_manager': <Badge variant="secondary" className="flex items-center gap-1"><Mail className="w-3 h-3" />Campaign Mgr</Badge>,
      'outreach_specialist': <Badge variant="outline" className="flex items-center gap-1"><Building className="w-3 h-3" />Specialist</Badge>
    }
    return badges[role as keyof typeof badges] || <Badge variant="outline">{role}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      'active': <Badge variant="default" className="bg-green-500"><Check className="w-3 h-3 mr-1" />Active</Badge>,
      'suspended': <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Suspended</Badge>,
      'pending': <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>,
      'inactive': <Badge variant="outline"><X className="w-3 h-3 mr-1" />Inactive</Badge>
    }
    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage all users across workspaces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Users
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" placeholder="user@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="workspace_admin">Workspace Admin</SelectItem>
                      <SelectItem value="campaign_manager">Campaign Manager</SelectItem>
                      <SelectItem value="outreach_specialist">Outreach Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="workspace">Workspace</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ws-1">ColdCopy HQ</SelectItem>
                      <SelectItem value="ws-2">TechCorp Solutions</SelectItem>
                      <SelectItem value="ws-3">StartupCo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleCreateUser({})} className="w-full">
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspendedUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="workspace_admin">Workspace Admin</SelectItem>
                <SelectItem value="campaign_manager">Campaign Manager</SelectItem>
                <SelectItem value="outreach_specialist">Outreach Specialist</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Login Count</TableHead>
                <TableHead>Security</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{user.workspaceName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDistanceToNow(user.lastActive, { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>{user.loginCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {user.emailVerified && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />Email
                        </Badge>
                      )}
                      {user.twoFactorEnabled && (
                        <Badge variant="outline" className="text-xs">
                          <Key className="w-3 h-3 mr-1" />2FA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                          View Details
                        </DropdownMenuItem>
                        {user.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleResendInvite(user.id)}>
                            Resend Invite
                          </DropdownMenuItem>
                        )}
                        {user.status === 'active' ? (
                          <DropdownMenuItem 
                            onClick={() => handleSuspendUser(user.id)}
                            className="text-red-600"
                          >
                            Suspend User
                          </DropdownMenuItem>
                        ) : user.status === 'suspended' ? (
                          <DropdownMenuItem 
                            onClick={() => handleActivateUser(user.id)}
                            className="text-green-600"
                          >
                            Activate User
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                Detailed information for {selectedUser.firstName} {selectedUser.lastName}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <div className="text-sm">{selectedUser.email}</div>
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <div className="text-sm">{selectedUser.firstName} {selectedUser.lastName}</div>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <div className="text-sm">{getRoleBadge(selectedUser.role)}</div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="text-sm">{getStatusBadge(selectedUser.status)}</div>
                  </div>
                  <div>
                    <Label>Workspace</Label>
                    <div className="text-sm">{selectedUser.workspaceName}</div>
                  </div>
                  <div>
                    <Label>Created</Label>
                    <div className="text-sm">{selectedUser.createdAt.toLocaleDateString()}</div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="security" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email Verified</Label>
                    <div className="text-sm">{selectedUser.emailVerified ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <Label>Two-Factor Auth</Label>
                    <div className="text-sm">{selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div>
                    <Label>Last IP Address</Label>
                    <div className="text-sm">{selectedUser.ipAddress}</div>
                  </div>
                  <div>
                    <Label>User Agent</Label>
                    <div className="text-sm">{selectedUser.userAgent}</div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="activity" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Last Active</Label>
                    <div className="text-sm">{formatDistanceToNow(selectedUser.lastActive, { addSuffix: true })}</div>
                  </div>
                  <div>
                    <Label>Login Count</Label>
                    <div className="text-sm">{selectedUser.loginCount} times</div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

import { Clock } from "lucide-react"