'use client'

import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Download
} from 'lucide-react'
import { Lead } from '@coldcopy/database'
import Papa from 'papaparse'

interface ImportLeadsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

interface ParsedLead {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  title?: string
  tags?: string[]
  [key: string]: any
}

interface ValidationResult {
  valid: ParsedLead[]
  invalid: Array<{ row: number; lead: ParsedLead; error: string }>
  duplicates: Array<{ row: number; lead: ParsedLead }>
}

export function ImportLeadsDialog({
  open,
  onOpenChange,
  workspaceId,
}: ImportLeadsDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)
  
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const downloadTemplate = () => {
    const template = [
      ['email', 'first_name', 'last_name', 'company', 'title', 'tags'],
      ['john@example.com', 'John', 'Doe', 'Acme Inc', 'CEO', 'prospect,high-value'],
      ['jane@example.com', 'Jane', 'Smith', 'TechCorp', 'CTO', 'prospect,technical'],
    ]
    
    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const checkExistingEmails = async (emails: string[]) => {
    const response = await api.leads.list(workspaceId, { emails: emails.join(',') })
    
    if (response.error) {
      console.error('Error checking existing emails:', response.error)
      return new Set<string>()
    }

    return new Set(response.data.map((lead: any) => lead.email))
  }

  const validateLeads = async (leads: ParsedLead[]): Promise<ValidationResult> => {
    const valid: ParsedLead[] = []
    const invalid: Array<{ row: number; lead: ParsedLead; error: string }> = []
    const duplicates: Array<{ row: number; lead: ParsedLead }> = []
    const emailsSeen = new Set<string>()

    // Check for existing emails in database
    const emails = leads.map(lead => lead.email).filter(Boolean)
    const existing = await checkExistingEmails(emails)
    setExistingEmails(existing)

    leads.forEach((lead, index) => {
      const row = index + 2 // Account for header row

      // Check required fields
      if (!lead.email) {
        invalid.push({ row, lead, error: 'Email is required' })
        return
      }

      // Validate email format
      if (!validateEmail(lead.email)) {
        invalid.push({ row, lead, error: 'Invalid email format' })
        return
      }

      // Check for duplicates in file
      if (emailsSeen.has(lead.email.toLowerCase())) {
        duplicates.push({ row, lead })
        return
      }
      emailsSeen.add(lead.email.toLowerCase())

      // Check for existing in database
      if (existing.has(lead.email)) {
        duplicates.push({ row, lead })
        return
      }

      // Process tags
      if (typeof lead.tags === 'string') {
        lead.tags = (lead.tags as string).split(',').map((tag: string) => tag.trim()).filter(Boolean)
      } else if (!Array.isArray(lead.tags)) {
        lead.tags = []
      }

      valid.push(lead)
    })

    return { valid, invalid, duplicates }
  }

  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setFile(selectedFile)
    setParsing(true)
    setValidation(null)

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const leads = results.data as ParsedLead[]
        const validationResult = await validateLeads(leads)
        setValidation(validationResult)
        setParsing(false)
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
        toast.error('Failed to parse CSV file')
        setParsing(false)
      },
    })
  }, [workspaceId])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await processFile(selectedFile)
  }, [processFile])

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const csvFile = files.find(file => file.name.endsWith('.csv'))
    
    if (csvFile) {
      await processFile(csvFile)
    } else {
      toast.error('Please drop a CSV file')
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleImport = async () => {
    if (!validation || validation.valid.length === 0) return

    setImporting(true)
    setProgress(0)

    try {
      const batchSize = 100
      const batches = []
      
      for (let i = 0; i < validation.valid.length; i += batchSize) {
        batches.push(validation.valid.slice(i, i + batchSize))
      }

      let imported = 0
      
      for (const batch of batches) {
        const promises = batch.map(lead => 
          api.leads.create(workspaceId, {
            email: lead.email.toLowerCase(),
            first_name: lead.first_name || undefined,
            last_name: lead.last_name || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
            tags: lead.tags || [],
            custom_fields: {},
          })
        )

        const results = await Promise.allSettled(promises)
        
        // Count successful imports
        const successful = results.filter(result => result.status === 'fulfilled' && !result.value.error).length
        const failed = results.length - successful
        
        if (failed > 0) {
          console.warn(`${failed} leads failed to import in this batch`)
        }

        imported += successful
        setProgress((imported / validation.valid.length) * 100)
        
        // Add a small delay between batches to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success(`Successfully imported ${imported} leads`)
      onOpenChange(false)
      resetState()
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import leads')
    } finally {
      setImporting(false)
    }
  }

  const resetState = () => {
    setFile(null)
    setValidation(null)
    setProgress(0)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) resetState()
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple leads at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file && (
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <FileSpreadsheet className={`h-12 w-12 mx-auto mb-4 ${
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <p className="text-sm text-muted-foreground mb-4">
                {isDragOver 
                  ? 'Drop your CSV file here' 
                  : 'Drag & drop a CSV file or click to browse'
                }
              </p>
              <div className="flex items-center justify-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
                <Button variant="ghost" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          )}

          {file && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Selected file: {file.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFile(null)
                    setValidation(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  disabled={parsing || importing}
                >
                  Change File
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {parsing && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Parsing CSV...</span>
            </div>
          )}

          {validation && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <span className="font-medium">{validation.valid.length}</span> valid leads
                  </AlertDescription>
                </Alert>
                
                {validation.invalid.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">{validation.invalid.length}</span> invalid
                    </AlertDescription>
                  </Alert>
                )}
                
                {validation.duplicates.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      <span className="font-medium">{validation.duplicates.length}</span> duplicates
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {validation.invalid.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Invalid entries:</p>
                    <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {validation.invalid.slice(0, 5).map((item, index) => (
                        <li key={index}>
                          Row {item.row}: {item.error} ({item.lead.email || 'no email'})
                        </li>
                      ))}
                      {validation.invalid.length > 5 && (
                        <li>... and {validation.invalid.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validation.duplicates.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Duplicate emails (will be skipped):</p>
                    <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {validation.duplicates.slice(0, 5).map((item, index) => (
                        <li key={index}>
                          Row {item.row}: {item.lead.email}
                        </li>
                      ))}
                      {validation.duplicates.length > 5 && (
                        <li>... and {validation.duplicates.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Importing leads... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!validation || validation.valid.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {validation?.valid.length || 0} Leads</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}