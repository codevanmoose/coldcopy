'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GenerateEmailDialog } from '@/components/ai/generate-email-dialog'
import { 
  Plus, 
  Trash2, 
  Clock, 
  Copy,
  MoreVertical,
  MoveUp,
  MoveDown,
  Sparkles
} from 'lucide-react'

interface EmailSequence {
  id: string
  subject: string
  body: string
  delayDays: number
  delayHours: number
  condition?: {
    type: 'always' | 'no_reply' | 'no_open' | 'opened' | 'clicked'
    value?: string
  }
}

interface SequenceBuilderProps {
  sequences: EmailSequence[]
  onSequencesChange: (sequences: EmailSequence[]) => void
  campaignType: 'sequence' | 'one-off' | 'drip'
}

const conditionLabels = {
  always: 'Always send',
  no_reply: 'If no reply to previous',
  no_open: 'If previous not opened',
  opened: 'If previous was opened',
  clicked: 'If link was clicked',
}

export function CampaignSequenceBuilder({ 
  sequences, 
  onSequencesChange,
  campaignType 
}: SequenceBuilderProps) {
  // Initialize expanded items to include all sequences by default
  const [expandedItems, setExpandedItems] = useState<string[]>(
    sequences.map((_, index) => index.toString())
  )

  const addSequence = () => {
    const newSequence: EmailSequence = {
      id: Date.now().toString(),
      subject: '',
      body: '',
      delayDays: sequences.length === 0 ? 0 : 3,
      delayHours: 0,
      condition: campaignType === 'sequence' ? { type: 'no_reply' } : undefined,
    }
    onSequencesChange([...sequences, newSequence])
    // Ensure new sequence is expanded
    setExpandedItems([...expandedItems, sequences.length.toString()])
  }

  const updateSequence = (index: number, updates: Partial<EmailSequence>) => {
    const updated = [...sequences]
    updated[index] = { ...updated[index], ...updates }
    onSequencesChange(updated)
  }

  const removeSequence = (index: number) => {
    onSequencesChange(sequences.filter((_, i) => i !== index))
    setExpandedItems(expandedItems.filter(item => item !== index.toString()))
  }

  const moveSequence = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sequences.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...sequences]
    const [removed] = updated.splice(index, 1)
    updated.splice(newIndex, 0, removed)
    onSequencesChange(updated)
  }

  const duplicateSequence = (index: number) => {
    const sequence = sequences[index]
    const duplicate: EmailSequence = {
      ...sequence,
      id: Date.now().toString(),
    }
    const updated = [...sequences]
    updated.splice(index + 1, 0, duplicate)
    onSequencesChange(updated)
  }

  const getDelayLabel = (seq: EmailSequence, index: number) => {
    if (index === 0) return 'Sent immediately'
    
    const parts = []
    if (seq.delayDays > 0) {
      parts.push(`${seq.delayDays} day${seq.delayDays > 1 ? 's' : ''}`)
    }
    if (seq.delayHours > 0) {
      parts.push(`${seq.delayHours} hour${seq.delayHours > 1 ? 's' : ''}`)
    }
    
    return parts.length > 0 ? `Wait ${parts.join(' and ')}` : 'No delay'
  }

  // React to sequences length changes to ensure expanded state is maintained
  React.useEffect(() => {
    if (sequences.length > 0 && expandedItems.length === 0) {
      setExpandedItems(sequences.map((_, index) => index.toString()))
    }
  }, [sequences.length, expandedItems.length])

  return (
    <div className="space-y-4">
      {sequences.length === 0 && campaignType !== 'one-off' ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No emails in this {campaignType === 'drip' ? 'series' : 'sequence'} yet
            </p>
            <Button onClick={addSequence}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Accordion 
            type="multiple" 
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="space-y-2"
          >
            {sequences.map((sequence, index) => (
              <AccordionItem 
                key={sequence.id} 
                value={index.toString()}
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {campaignType === 'one-off' ? 'Email' : `Step ${index + 1}`}
                      </Badge>
                      <div className="text-left">
                        <p className="font-medium">
                          {sequence.subject || 'No subject yet'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getDelayLabel(sequence, index)}
                          {sequence.condition && campaignType === 'sequence' && (
                            <>
                              <span>•</span>
                              <span>{conditionLabels[sequence.condition.type]}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {campaignType !== 'one-off' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {index > 0 && (
                            <DropdownMenuItem onClick={() => moveSequence(index, 'up')}>
                              <MoveUp className="mr-2 h-4 w-4" />
                              Move Up
                            </DropdownMenuItem>
                          )}
                          {index < sequences.length - 1 && (
                            <DropdownMenuItem onClick={() => moveSequence(index, 'down')}>
                              <MoveDown className="mr-2 h-4 w-4" />
                              Move Down
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => duplicateSequence(index)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => removeSequence(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-4">
                    {/* Timing & Conditions */}
                    {index > 0 && campaignType !== 'one-off' && (
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Timing & Conditions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Wait Days</Label>
                              <Input
                                type="number"
                                min="0"
                                value={sequence.delayDays}
                                onChange={(e) => updateSequence(index, { 
                                  delayDays: parseInt(e.target.value) || 0 
                                })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Wait Hours</Label>
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                value={sequence.delayHours}
                                onChange={(e) => updateSequence(index, { 
                                  delayHours: parseInt(e.target.value) || 0 
                                })}
                              />
                            </div>
                          </div>
                          
                          {campaignType === 'sequence' && (
                            <div className="space-y-2">
                              <Label>Send Condition</Label>
                              <Select
                                value={sequence.condition?.type || 'always'}
                                onValueChange={(value) => updateSequence(index, {
                                  condition: { 
                                    type: value as any,
                                    value: sequence.condition?.value 
                                  }
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="always">Always send</SelectItem>
                                  <SelectItem value="no_reply">If no reply to previous</SelectItem>
                                  <SelectItem value="no_open">If previous not opened</SelectItem>
                                  <SelectItem value="opened">If previous was opened</SelectItem>
                                  <SelectItem value="clicked">If link was clicked</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Email Content */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Subject Line</Label>
                          <GenerateEmailDialog
                            leadInfo={{ email: 'recipient@example.com' }}
                            onGenerated={(subject, body) => {
                              updateSequence(index, { subject, body })
                            }}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate with AI
                              </Button>
                            }
                          />
                        </div>
                        <Input
                          placeholder="Enter email subject..."
                          value={sequence.subject}
                          onChange={(e) => updateSequence(index, { subject: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email Body</Label>
                        <Textarea
                          placeholder="Enter email content..."
                          rows={8}
                          value={sequence.body}
                          onChange={(e) => updateSequence(index, { body: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {"{{name}}"}, {"{{company}}"}, {"{{title}}"} for personalization
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {campaignType !== 'one-off' && (
            <Button onClick={addSequence} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add {campaignType === 'sequence' ? 'Follow-up' : 'Next Email'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}