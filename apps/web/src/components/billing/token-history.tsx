'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { Zap, Plus, Minus, RefreshCw, Gift, AlertCircle } from 'lucide-react'

interface TokenTransaction {
  id: string
  type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'grant'
  amount: number
  balance_after: number
  description: string
  reference_type?: string
  metadata?: any
  created_at: string
  user?: {
    email: string
    name?: string
  }
}

interface TokenHistoryProps {
  workspaceId: string
  limit?: number
}

const typeConfig = {
  purchase: {
    icon: Plus,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Purchase',
  },
  usage: {
    icon: Minus,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Usage',
  },
  refund: {
    icon: RefreshCw,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Refund',
  },
  adjustment: {
    icon: AlertCircle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Adjustment',
  },
  grant: {
    icon: Gift,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    label: 'Grant',
  },
}

export function TokenHistory({ workspaceId, limit = 20 }: TokenHistoryProps) {
  const supabase = createClient()

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['token-transactions', workspaceId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('token_transactions')
        .select(`
          *,
          user:users(email, name)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as TokenTransaction[]
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Zap className="h-8 w-8 animate-pulse text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token History</CardTitle>
          <CardDescription>
            Your token transaction history will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No token transactions yet
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token History</CardTitle>
        <CardDescription>
          Recent token transactions and usage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const config = typeConfig[transaction.type]
              const Icon = config.icon
              
              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${config.bgColor}`}>
                        <Icon className={`h-3 w-3 ${config.color}`} />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.balance_after.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {transaction.user?.email || 'System'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}