'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner'
import { 
  Search, 
  Upload, 
  Download, 
  MoreHorizontal, 
  Mail, 
  Trash2, 
  Filter,
  Plus,
  Users,
  Building,
  UserCheck,
  UserX,
  Loader2,
  Sparkles
} from 'lucide-react'
import { Lead, LeadStatus } from '@coldcopy/database'
import { ImportLeadsDialog } from '@/components/leads/import-leads-dialog'
import { GenerateEmailDialog } from '@/components/ai/generate-email-dialog'
import { LeadEnrichment } from '@/components/leads/lead-enrichment'
import { format } from 'date-fns'

const statusIcons = {
  new: Users,
  contacted: Mail,
  replied: UserCheck,
  qualified: UserCheck,
  unqualified: UserX,
  unsubscribed: UserX,
}

const statusColors = {
  new: 'secondary',
  contacted: 'default',
  replied: 'success',
  qualified: 'success',
  unqualified: 'destructive',
  unsubscribed: 'outline',
}

export default function LeadsPage() {
  const { workspace } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', workspace?.id, searchQuery],
    queryFn: async () => {
      if (!workspace) return []
      
      let query = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })

      if (searchQuery) {
        query = query.or(
          `email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`
        )
      }

      const { data, error } = await query

      if (error) throw error
      return data as Lead[]
    },
    enabled: !!workspace,
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead status updated')
    },
    onError: () => {
      toast.error('Failed to update lead status')
    },
  })

  const deleteLeadsMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Leads deleted successfully')
      setSelectedLeads([])
    },
    onError: () => {
      toast.error('Failed to delete leads')
    },
  })

  const exportLeads = () => {
    if (!leads) return

    const csv = [
      ['Email', 'First Name', 'Last Name', 'Company', 'Title', 'Status', 'Tags', 'Created At'],
      ...leads.map(lead => [
        lead.email,
        lead.first_name || '',
        lead.last_name || '',
        lead.company || '',
        lead.title || '',
        lead.status,
        lead.tags.join(', '),
        format(new Date(lead.created_at), 'yyyy-MM-dd'),
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    if (selectedLeads.length === leads?.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(leads?.map(lead => lead.id) || [])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">
          Manage and organize your outreach contacts
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.length > 0 && (
            <>
              <LeadEnrichment
                leads={leads?.filter(lead => selectedLeads.includes(lead.id)) || []}
                onUpdate={refetch}
                trigger={
                  <Button variant="outline" size="sm">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enrich ({selectedLeads.length})
                  </Button>
                }
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteLeadsMutation.mutate(selectedLeads)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedLeads.length})
              </Button>
            </>
          )}
          <Button variant="outline" onClick={exportLeads}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            {leads?.length || 0} leads in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === leads?.length && leads?.length > 0}
                      onChange={selectAllLeads}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads?.map((lead) => {
                  const StatusIcon = statusIcons[lead.status]
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {lead.first_name || lead.last_name
                              ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                              : 'No name'}
                          </p>
                          <p className="text-sm text-muted-foreground">{lead.email}</p>
                          {lead.title && (
                            <p className="text-sm text-muted-foreground">{lead.title}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.company ? (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {lead.company}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusColors[lead.status] as any}
                          className="gap-1"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {lead.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {lead.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{lead.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(lead.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <LeadEnrichment
                              lead={lead}
                              onUpdate={refetch}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Sparkles className="mr-2 h-4 w-4" />
                                  Enrich Lead Data
                                </DropdownMenuItem>
                              }
                            />
                            <GenerateEmailDialog
                              leadInfo={{
                                name: lead.name,
                                email: lead.email,
                                title: lead.title,
                                company: lead.company,
                                industry: lead.industry,
                              }}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  Generate Email with AI
                                </DropdownMenuItem>
                              }
                            />
                            <DropdownMenuItem>Add to Campaign</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({
                                leadId: lead.id,
                                status: 'qualified'
                              })}
                            >
                              Mark as Qualified
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({
                                leadId: lead.id,
                                status: 'unqualified'
                              })}
                            >
                              Mark as Unqualified
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteLeadsMutation.mutate([lead.id])}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        workspaceId={workspace?.id || ''}
      />
    </div>
  )
}