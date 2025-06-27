'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { Filter, SortAsc, Tag, User, AlertCircle } from 'lucide-react'

interface ThreadFiltersProps {
  onFilterChange: (filters: any) => void
  activeFilters: any
}

export function ThreadFilters({ onFilterChange, activeFilters }: ThreadFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
            {Object.keys(activeFilters).length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {Object.keys(activeFilters).length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={activeFilters.status?.includes('open')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Open
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activeFilters.status?.includes('closed')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Closed
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activeFilters.status?.includes('archived')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Archived
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={activeFilters.priority?.includes('urgent')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
            Urgent
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activeFilters.priority?.includes('high')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            <AlertCircle className="mr-2 h-4 w-4 text-orange-600" />
            High
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activeFilters.priority?.includes('normal')}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Normal
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Other Filters</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={activeFilters.unread}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Unread Only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activeFilters.hasAttachments}
            onCheckedChange={(checked) => {
              // Handle filter change
            }}
          >
            Has Attachments
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <SortAsc className="mr-2 h-4 w-4" />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Newest First</DropdownMenuItem>
          <DropdownMenuItem>Oldest First</DropdownMenuItem>
          <DropdownMenuItem>Priority</DropdownMenuItem>
          <DropdownMenuItem>Sender Name</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}