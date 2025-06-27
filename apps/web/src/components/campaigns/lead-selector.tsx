'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Search, 
  Users, 
  Filter,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react'

interface Lead {
  id: string
  email: string
  name?: string
  company?: string
  title?: string
  status: string
  tags: string[]
}

interface LeadSelectorProps {
  selectedLeads: string[]
  onSelectionChange: (leads: string[]) => void
  workspaceId: string
}

type SelectionMode = 'all' | 'filter' | 'manual'

export function LeadSelector({ 
  selectedLeads, 
  onSelectionChange,
  workspaceId 
}: LeadSelectorProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('filter')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const supabase = createClient()

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['campaign-leads', workspaceId, searchQuery, statusFilter, tagFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Lead[]
    },
    enabled: selectionMode === 'manual',
  })

  // Fetch all tags for filter
  const { data: allTags = [] } = useQuery({
    queryKey: ['lead-tags', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('tags')
        .eq('workspace_id', workspaceId)

      if (error) throw error
      
      const tagSet = new Set<string>()
      data?.forEach(lead => {
        lead.tags?.forEach((tag: string) => tagSet.add(tag))
      })
      
      return Array.from(tagSet).sort()
    },
  })

  // Filter leads based on tag
  const filteredLeads = tagFilter === 'all' 
    ? leads 
    : leads.filter(lead => lead.tags.includes(tagFilter))

  const handleModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode)
    
    if (mode === 'all') {
      // In real implementation, this would select all leads
      onSelectionChange([])
    } else if (mode === 'filter') {
      onSelectionChange([])
    }
  }

  const toggleLead = (leadId: string) => {
    if (selectedLeads.includes(leadId)) {
      onSelectionChange(selectedLeads.filter(id => id !== leadId))
    } else {
      onSelectionChange([...selectedLeads, leadId])
    }
  }

  const toggleAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(filteredLeads.map(lead => lead.id))
    }
  }

  return (
    <div className="space-y-4">
      <RadioGroup value={selectionMode} onValueChange={(value) => handleModeChange(value as SelectionMode)}>
        <div className="grid gap-3">
          <Card className="cursor-pointer" onClick={() => handleModeChange('all')}>
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="flex-1 cursor-pointer">
                <div className="font-medium">All Leads</div>
                <div className="text-sm text-muted-foreground">
                  Send to all leads in your workspace
                </div>
              </Label>
            </CardContent>
          </Card>

          <Card className="cursor-pointer" onClick={() => handleModeChange('filter')}>
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="filter" id="filter" />
              <Label htmlFor="filter" className="flex-1 cursor-pointer">
                <div className="font-medium">Filter by Criteria</div>
                <div className="text-sm text-muted-foreground">
                  Select leads based on status, tags, or other criteria
                </div>
              </Label>
            </CardContent>
          </Card>

          <Card className="cursor-pointer" onClick={() => handleModeChange('manual')}>
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual" className="flex-1 cursor-pointer">
                <div className="font-medium">Manual Selection</div>
                <div className="text-sm text-muted-foreground">
                  Hand-pick specific leads for this campaign
                </div>
              </Label>
            </CardContent>
          </Card>
        </div>
      </RadioGroup>

      {selectionMode === 'filter' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Lead Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="unqualified">Unqualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Filtered selection will be applied when the campaign starts.
                New leads matching criteria will automatically be included.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {selectionMode === 'manual' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
              >
                {selectedLeads.length === filteredLeads.length ? (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Select All
                  </>
                )}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No leads found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => toggleLead(lead.id)}
                  >
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{lead.name || lead.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {lead.company && `${lead.company} • `}
                        {lead.email}
                      </div>
                      {lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {lead.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {lead.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{lead.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedLeads.length} leads selected
              </p>
              {selectedLeads.length > 0 && (
                <Badge variant="secondary">
                  <Users className="mr-1 h-3 w-3" />
                  {selectedLeads.length} selected
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}