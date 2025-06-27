'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Save, RefreshCw, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/client'

interface FieldMapping {
  id?: string
  object_type: 'contacts' | 'companies' | 'deals'
  coldcopy_field: string
  hubspot_field: string
  direction: 'to_hubspot' | 'from_hubspot' | 'bidirectional'
  is_required: boolean
  transform_function?: string
}

interface HubSpotProperty {
  name: string
  label: string
  type: string
  description?: string
  options?: Array<{ label: string; value: string }>
}

const COLDCOPY_FIELDS = {
  contacts: [
    { name: 'email', label: 'Email', type: 'string', required: true },
    { name: 'first_name', label: 'First Name', type: 'string' },
    { name: 'last_name', label: 'Last Name', type: 'string' },
    { name: 'company', label: 'Company', type: 'string' },
    { name: 'job_title', label: 'Job Title', type: 'string' },
    { name: 'phone', label: 'Phone', type: 'string' },
    { name: 'website', label: 'Website', type: 'string' },
    { name: 'location', label: 'Location', type: 'string' },
    { name: 'linkedin_url', label: 'LinkedIn URL', type: 'string' },
    { name: 'twitter_url', label: 'Twitter URL', type: 'string' },
    { name: 'tags', label: 'Tags', type: 'array' },
    { name: 'status', label: 'Status', type: 'string' },
    { name: 'enrichment_data', label: 'Enrichment Data', type: 'object' },
  ],
  companies: [
    { name: 'name', label: 'Company Name', type: 'string', required: true },
    { name: 'domain', label: 'Domain', type: 'string' },
    { name: 'industry', label: 'Industry', type: 'string' },
    { name: 'phone', label: 'Phone', type: 'string' },
    { name: 'city', label: 'City', type: 'string' },
    { name: 'state', label: 'State', type: 'string' },
    { name: 'country', label: 'Country', type: 'string' },
    { name: 'employee_count', label: 'Employee Count', type: 'number' },
    { name: 'annual_revenue', label: 'Annual Revenue', type: 'number' },
    { name: 'description', label: 'Description', type: 'string' },
  ],
  deals: [
    { name: 'dealname', label: 'Deal Name', type: 'string', required: true },
    { name: 'amount', label: 'Amount', type: 'number' },
    { name: 'dealstage', label: 'Deal Stage', type: 'string' },
    { name: 'pipeline', label: 'Pipeline', type: 'string' },
    { name: 'closedate', label: 'Close Date', type: 'date' },
    { name: 'dealtype', label: 'Deal Type', type: 'string' },
    { name: 'description', label: 'Description', type: 'string' },
    { name: 'lead_source', label: 'Lead Source', type: 'string' },
  ],
}

export default function HubSpotMappingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [hubspotProperties, setHubspotProperties] = useState<Record<string, HubSpotProperty[]>>({})
  const [selectedObjectType, setSelectedObjectType] = useState<'contacts' | 'companies' | 'deals'>('contacts')

  useEffect(() => {
    if (user?.workspace_id) {
      loadMappingData()
    }
  }, [user?.workspace_id])

  const loadMappingData = async () => {
    if (!user?.workspace_id) return

    setLoading(true)
    const supabase = createClient()

    try {
      // Load existing field mappings
      const { data: mappings } = await supabase
        .from('hubspot_field_mappings')
        .select('*')
        .eq('workspace_id', user.workspace_id)

      if (mappings) {
        setFieldMappings(mappings)
      }

      // Load HubSpot properties for all object types
      for (const objectType of ['contacts', 'companies', 'deals']) {
        try {
          const response = await fetch(`/api/integrations/hubspot/properties?object_type=${objectType}`)
          if (response.ok) {
            const properties = await response.json()
            setHubspotProperties(prev => ({
              ...prev,
              [objectType]: properties
            }))
          }
        } catch (error) {
          console.error(`Failed to load ${objectType} properties:`, error)
        }
      }

    } catch (error) {
      console.error('Failed to load mapping data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load field mappings',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveMappings = async () => {
    if (!user?.workspace_id) return

    setSaving(true)
    const supabase = createClient()

    try {
      // Filter mappings for current object type
      const currentMappings = fieldMappings.filter(m => m.object_type === selectedObjectType)

      // Prepare mappings for upsert
      const mappingsToSave = currentMappings.map(mapping => ({
        ...mapping,
        workspace_id: user.workspace_id,
      }))

      // Delete existing mappings for this object type
      await supabase
        .from('hubspot_field_mappings')
        .delete()
        .eq('workspace_id', user.workspace_id)
        .eq('object_type', selectedObjectType)

      // Insert new mappings
      if (mappingsToSave.length > 0) {
        const { error } = await supabase
          .from('hubspot_field_mappings')
          .insert(mappingsToSave)

        if (error) throw error
      }

      toast({
        title: 'Success',
        description: 'Field mappings saved successfully',
      })

    } catch (error) {
      console.error('Failed to save mappings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save field mappings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const addMapping = () => {
    const newMapping: FieldMapping = {
      object_type: selectedObjectType,
      coldcopy_field: '',
      hubspot_field: '',
      direction: 'bidirectional',
      is_required: false,
    }

    setFieldMappings([...fieldMappings, newMapping])
  }

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updated = [...fieldMappings]
    const globalIndex = fieldMappings.findIndex((_, i) => 
      fieldMappings.filter(m => m.object_type === selectedObjectType)[index] === fieldMappings[i]
    )
    if (globalIndex !== -1) {
      updated[globalIndex] = { ...updated[globalIndex], ...updates }
      setFieldMappings(updated)
    }
  }

  const removeMapping = (index: number) => {
    const filtered = fieldMappings.filter(m => m.object_type === selectedObjectType)
    const toRemove = filtered[index]
    setFieldMappings(fieldMappings.filter(m => m !== toRemove))
  }

  const getDefaultMappings = () => {
    const defaults: FieldMapping[] = []
    const coldcopyFields = COLDCOPY_FIELDS[selectedObjectType]
    const hubspotProps = hubspotProperties[selectedObjectType] || []

    // Create default mappings for common fields
    const commonMappings = {
      contacts: [
        { coldcopy: 'email', hubspot: 'email' },
        { coldcopy: 'first_name', hubspot: 'firstname' },
        { coldcopy: 'last_name', hubspot: 'lastname' },
        { coldcopy: 'company', hubspot: 'company' },
        { coldcopy: 'job_title', hubspot: 'jobtitle' },
        { coldcopy: 'phone', hubspot: 'phone' },
        { coldcopy: 'website', hubspot: 'website' },
      ],
      companies: [
        { coldcopy: 'name', hubspot: 'name' },
        { coldcopy: 'domain', hubspot: 'domain' },
        { coldcopy: 'industry', hubspot: 'industry' },
        { coldcopy: 'phone', hubspot: 'phone' },
        { coldcopy: 'city', hubspot: 'city' },
        { coldcopy: 'description', hubspot: 'description' },
      ],
      deals: [
        { coldcopy: 'dealname', hubspot: 'dealname' },
        { coldcopy: 'amount', hubspot: 'amount' },
        { coldcopy: 'dealstage', hubspot: 'dealstage' },
        { coldcopy: 'closedate', hubspot: 'closedate' },
        { coldcopy: 'dealtype', hubspot: 'dealtype' },
      ],
    }

    const objectMappings = commonMappings[selectedObjectType] || []

    for (const mapping of objectMappings) {
      const coldcopyField = coldcopyFields.find(f => f.name === mapping.coldcopy)
      const hubspotField = hubspotProps.find(p => p.name === mapping.hubspot)

      if (coldcopyField && hubspotField) {
        defaults.push({
          object_type: selectedObjectType,
          coldcopy_field: mapping.coldcopy,
          hubspot_field: mapping.hubspot,
          direction: 'bidirectional',
          is_required: coldcopyField.required || false,
        })
      }
    }

    return defaults
  }

  const loadDefaultMappings = () => {
    const defaults = getDefaultMappings()
    const filtered = fieldMappings.filter(m => m.object_type !== selectedObjectType)
    setFieldMappings([...filtered, ...defaults])
  }

  const currentMappings = fieldMappings.filter(m => m.object_type === selectedObjectType)
  const coldcopyFields = COLDCOPY_FIELDS[selectedObjectType]
  const hubspotProps = hubspotProperties[selectedObjectType] || []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HubSpot Field Mapping</h1>
          <p className="text-muted-foreground">
            Configure how ColdCopy fields map to HubSpot properties
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadMappingData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveMappings} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Mappings
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={selectedObjectType} onValueChange={(value) => setSelectedObjectType(value as any)}>
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedObjectType} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Field Mappings - {selectedObjectType}</CardTitle>
                  <CardDescription>
                    Map ColdCopy fields to HubSpot properties for synchronization
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button onClick={loadDefaultMappings} variant="outline" size="sm">
                    Load Defaults
                  </Button>
                  <Button onClick={addMapping} size="sm">
                    Add Mapping
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {currentMappings.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No field mappings configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Create field mappings to synchronize data between ColdCopy and HubSpot
                  </p>
                  <Button onClick={loadDefaultMappings}>
                    Load Default Mappings
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                    <div className="col-span-3">ColdCopy Field</div>
                    <div className="col-span-1 text-center">Direction</div>
                    <div className="col-span-3">HubSpot Property</div>
                    <div className="col-span-2">Options</div>
                    <div className="col-span-2">Transform</div>
                    <div className="col-span-1">Actions</div>
                  </div>

                  {currentMappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-center">
                      {/* ColdCopy Field */}
                      <div className="col-span-3">
                        <Select
                          value={mapping.coldcopy_field}
                          onValueChange={(value) => updateMapping(index, { coldcopy_field: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ColdCopy field" />
                          </SelectTrigger>
                          <SelectContent>
                            {coldcopyFields.map(field => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{field.label}</span>
                                  {field.required && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Direction */}
                      <div className="col-span-1 flex justify-center">
                        <Select
                          value={mapping.direction}
                          onValueChange={(value) => updateMapping(index, { direction: value as any })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to_hubspot">→</SelectItem>
                            <SelectItem value="from_hubspot">←</SelectItem>
                            <SelectItem value="bidirectional">↔</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* HubSpot Property */}
                      <div className="col-span-3">
                        <Select
                          value={mapping.hubspot_field}
                          onValueChange={(value) => updateMapping(index, { hubspot_field: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select HubSpot property" />
                          </SelectTrigger>
                          <SelectContent>
                            {hubspotProps.map(prop => (
                              <SelectItem key={prop.name} value={prop.name}>
                                <div>
                                  <div>{prop.label}</div>
                                  <div className="text-xs text-muted-foreground">{prop.name} ({prop.type})</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Options */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={mapping.is_required}
                            onCheckedChange={(checked) => updateMapping(index, { is_required: checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>

                      {/* Transform Function */}
                      <div className="col-span-2">
                        <Input
                          placeholder="transform(value)"
                          value={mapping.transform_function || ''}
                          onChange={(e) => updateMapping(index, { transform_function: e.target.value })}
                          className="text-xs"
                        />
                      </div>

                      {/* Actions */}
                      <div className="col-span-1">
                        <Button
                          onClick={() => removeMapping(index)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Field Reference */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ColdCopy Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coldcopyFields.map(field => (
                    <div key={field.name} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{field.label}</span>
                        <span className="text-muted-foreground ml-2">({field.type})</span>
                      </div>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">HubSpot Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {hubspotProps.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Connect to HubSpot to load available properties
                    </p>
                  ) : (
                    hubspotProps.slice(0, 20).map(prop => (
                      <div key={prop.name} className="text-sm">
                        <div className="font-medium">{prop.label}</div>
                        <div className="text-muted-foreground text-xs">
                          {prop.name} ({prop.type})
                        </div>
                      </div>
                    ))
                  )}
                  {hubspotProps.length > 20 && (
                    <p className="text-xs text-muted-foreground">
                      ... and {hubspotProps.length - 20} more properties
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}