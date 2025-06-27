"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { 
  Calendar, Plus, LinkIcon, Users, Clock, CheckCircle2, 
  XCircle, AlertCircle, TrendingUp, BarChart3, Settings,
  Eye, Edit, Trash2, Copy, ExternalLink, Mail, Phone,
  MapPin, Globe, RefreshCw, CalendarDays, Video, User
} from "lucide-react"
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"
import { format, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns"
import Link from "next/link"

interface CalendarAccount {
  id: string
  provider: string
  email: string
  display_name: string
  is_primary: boolean
  is_active: boolean
  timezone: string
  last_sync_at?: string
  sync_error?: string
  connected_at: string
}

interface BookingPage {
  id: string
  slug: string
  name: string
  description?: string
  meeting_type: string
  duration_minutes: number
  timezone: string
  is_active: boolean
  total_bookings: number
  calendar_account_email: string
  created_at: string
}

interface Meeting {
  id: string
  title: string
  start_time: string
  end_time: string
  timezone: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_company?: string
  meeting_location?: string
  meeting_link?: string
  status: string
  booking_page_name: string
  booked_at: string
}

const PROVIDER_ICONS = {
  google: <Mail className="w-4 h-4" />,
  microsoft: <Globe className="w-4 h-4" />,
  outlook: <Globe className="w-4 h-4" />,
  office365: <Globe className="w-4 h-4" />
}

const STATUS_COLORS = {
  scheduled: { bg: 'bg-blue-500', text: 'text-blue-500' },
  confirmed: { bg: 'bg-green-500', text: 'text-green-500' },
  cancelled: { bg: 'bg-red-500', text: 'text-red-500' },
  completed: { bg: 'bg-purple-500', text: 'text-purple-500' },
  no_show: { bg: 'bg-orange-500', text: 'text-orange-500' }
}

const MEETING_TYPE_LABELS = {
  discovery_call: 'Discovery Call',
  demo: 'Demo',
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  closing_call: 'Closing Call',
  onboarding: 'Onboarding',
  custom: 'Custom'
}

export default function CalendarDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [bookingPages, setBookingPages] = useState<BookingPage[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // API calls would go here
      // const [accountsRes, pagesRes, meetingsRes] = await Promise.all([
      //   fetch('/api/calendar/accounts'),
      //   fetch('/api/calendar/booking-pages'),
      //   fetch('/api/calendar/meetings')
      // ])
      
      // Mock data
      const mockAccounts: CalendarAccount[] = [
        {
          id: '1',
          provider: 'google',
          email: 'john.doe@company.com',
          display_name: 'John Doe',
          is_primary: true,
          is_active: true,
          timezone: 'America/New_York',
          last_sync_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          connected_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          provider: 'microsoft',
          email: 'john@outlook.com',
          display_name: 'John Personal',
          is_primary: false,
          is_active: true,
          timezone: 'America/New_York',
          last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          connected_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      const mockBookingPages: BookingPage[] = [
        {
          id: '1',
          slug: 'john-doe-demo',
          name: 'Product Demo',
          description: 'Schedule a 30-minute product demonstration',
          meeting_type: 'demo',
          duration_minutes: 30,
          timezone: 'America/New_York',
          is_active: true,
          total_bookings: 47,
          calendar_account_email: 'john.doe@company.com',
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          slug: 'discovery-call',
          name: 'Discovery Call',
          description: 'Initial discovery conversation',
          meeting_type: 'discovery_call',
          duration_minutes: 45,
          timezone: 'America/New_York',
          is_active: true,
          total_bookings: 23,
          calendar_account_email: 'john.doe@company.com',
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      const mockMeetings: Meeting[] = [
        {
          id: '1',
          title: 'Product Demo with Sarah Johnson',
          start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(),
          timezone: 'America/New_York',
          attendee_name: 'Sarah Johnson',
          attendee_email: 'sarah@startup.com',
          attendee_phone: '+1 (555) 123-4567',
          attendee_company: 'TechStartup Inc',
          meeting_location: 'Zoom',
          meeting_link: 'https://zoom.us/j/123456789',
          status: 'confirmed',
          booking_page_name: 'Product Demo',
          booked_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          title: 'Discovery Call with Michael Chen',
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(Date.now() + 24.75 * 60 * 60 * 1000).toISOString(),
          timezone: 'America/New_York',
          attendee_name: 'Michael Chen',
          attendee_email: 'michael@enterprise.com',
          attendee_company: 'Enterprise Corp',
          meeting_location: 'Google Meet',
          status: 'scheduled',
          booking_page_name: 'Discovery Call',
          booked_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ]

      setAccounts(mockAccounts)
      setBookingPages(mockBookingPages)
      setUpcomingMeetings(mockMeetings)
    } catch (error) {
      toast.error("Failed to load calendar data")
    } finally {
      setIsLoading(false)
    }
  }

  const copyBookingLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("Booking link copied to clipboard!")
  }

  const connectCalendar = (provider: string) => {
    // This would redirect to OAuth flow
    toast.info(`Redirecting to ${provider} authentication...`)
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.scheduled
    return (
      <Badge className={`${config.bg} text-white`}>
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    )
  }

  // Mock analytics data
  const bookingTrend = Array.from({ length: 30 }, (_, i) => ({
    date: format(new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000), 'MMM dd'),
    bookings: Math.floor(Math.random() * 8) + 1
  }))

  const statusDistribution = [
    { name: 'Confirmed', value: 45, color: '#10B981' },
    { name: 'Scheduled', value: 30, color: '#3B82F6' },
    { name: 'Completed', value: 20, color: '#8B5CF6' },
    { name: 'Cancelled', value: 5, color: '#EF4444' }
  ]

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
            <Calendar className="w-8 h-8" />
            Calendar & Booking
          </h1>
          <p className="text-muted-foreground">Manage your calendar integrations and booking pages</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/calendar/booking-pages/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Booking Page
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter(a => a.is_active).length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booking Pages</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingPages.length}</div>
            <p className="text-xs text-muted-foreground">
              {bookingPages.filter(p => p.is_active).length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMeetings.length}</div>
            <p className="text-xs text-muted-foreground">
              Next 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookingPages.reduce((sum, p) => sum + p.total_bookings, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+12%</span> this month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="pages">Booking Pages</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Meetings */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Meetings</CardTitle>
                <CardDescription>Your next scheduled appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{meeting.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(meeting.start_time), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          {getStatusBadge(meeting.status)}
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{meeting.attendee_name}</span>
                            {meeting.attendee_company && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{meeting.attendee_company}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{meeting.attendee_email}</span>
                          </div>
                          
                          {meeting.meeting_location && (
                            <div className="flex items-center gap-2">
                              {meeting.meeting_link ? (
                                <Video className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span>{meeting.meeting_location}</span>
                              {meeting.meeting_link && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {upcomingMeetings.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No upcoming meetings</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Booking Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Active Booking Pages</CardTitle>
                <CardDescription>Your public booking links</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bookingPages.filter(p => p.is_active).map((page) => (
                    <div key={page.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{page.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {MEETING_TYPE_LABELS[page.meeting_type as keyof typeof MEETING_TYPE_LABELS]} • {page.duration_minutes} min
                          </p>
                        </div>
                        <Badge variant="outline">
                          {page.total_bookings} bookings
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyBookingLink(page.slug)}
                        >
                          <Copy className="w-3 h-3 mr-2" />
                          Copy Link
                        </Button>
                        
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/book/${page.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-3 h-3 mr-2" />
                            Preview
                          </a>
                        </Button>
                        
                        <Link href={`/calendar/booking-pages/${page.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit className="w-3 h-3 mr-2" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  {bookingPages.filter(p => p.is_active).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No active booking pages</p>
                      <Link href="/calendar/booking-pages/new">
                        <Button variant="outline" size="sm" className="mt-2">
                          Create your first booking page
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Setup */}
          {accounts.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Setup</CardTitle>
                <CardDescription>Get started with calendar integration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={() => connectCalendar('Google')}
                  >
                    <Mail className="w-6 h-6" />
                    <span>Connect Google Calendar</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={() => connectCalendar('Microsoft')}
                  >
                    <Globe className="w-6 h-6" />
                    <span>Connect Outlook Calendar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Meetings</CardTitle>
              <CardDescription>Manage your scheduled appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{meeting.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(meeting.start_time), 'EEEE, MMMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      {getStatusBadge(meeting.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Attendee</p>
                        <p className="font-medium">{meeting.attendee_name}</p>
                        <p className="text-muted-foreground">{meeting.attendee_email}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Meeting Type</p>
                        <p className="font-medium">{meeting.booking_page_name}</p>
                        {meeting.attendee_company && (
                          <p className="text-muted-foreground">{meeting.attendee_company}</p>
                        )}
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-medium">{meeting.meeting_location || 'Not specified'}</p>
                        {meeting.meeting_link && (
                          <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                            <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                              Join Meeting
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Pages</CardTitle>
              <CardDescription>Manage your booking page configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bookingPages.map((page) => (
                  <Card key={page.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{page.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={page.is_active ? "default" : "secondary"}>
                            {page.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      {page.description && (
                        <CardDescription>{page.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{page.duration_minutes} minutes</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total Bookings</span>
                          <span className="font-medium">{page.total_bookings}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Booking URL</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyBookingLink(page.slug)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/book/${page.slug}`} target="_blank">
                              <Eye className="w-3 h-3 mr-2" />
                              Preview
                            </a>
                          </Button>
                          
                          <Link href={`/calendar/booking-pages/${page.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="w-3 h-3 mr-2" />
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage your calendar integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div key={account.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {PROVIDER_ICONS[account.provider as keyof typeof PROVIDER_ICONS]}
                        <div>
                          <p className="font-medium">{account.display_name}</p>
                          <p className="text-sm text-muted-foreground">{account.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {account.is_primary && (
                          <Badge variant="default">Primary</Badge>
                        )}
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Provider</p>
                        <p className="font-medium capitalize">{account.provider}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Timezone</p>
                        <p className="font-medium">{account.timezone}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">
                          {account.last_sync_at 
                            ? format(new Date(account.last_sync_at), 'MMM d, h:mm a')
                            : 'Never'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Connected</p>
                        <p className="font-medium">
                          {format(new Date(account.connected_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    {account.sync_error && (
                      <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {account.sync_error}
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="flex items-center gap-2">
                  <Button onClick={() => connectCalendar('Google')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                  
                  <Button variant="outline" onClick={() => connectCalendar('Microsoft')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Outlook
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Booking Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Trend</CardTitle>
                <CardDescription>Daily bookings over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={bookingTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="bookings" 
                      stroke="#6366F1" 
                      fill="#6366F1" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Status Distribution</CardTitle>
                <CardDescription>Current status of all meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {statusDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}: {item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}