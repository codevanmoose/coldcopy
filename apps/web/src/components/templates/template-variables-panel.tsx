import { useState } from 'react'
import { TemplateVariable } from './types'
import { defaultVariables } from './template-variables'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateVariablesPanelProps {
  variables: TemplateVariable[]
  onVariablesChange: (variables: TemplateVariable[]) => void
  onInsertVariable?: (variable: TemplateVariable) => void
  className?: string
}

export function TemplateVariablesPanel({
  variables,
  onVariablesChange,
  onInsertVariable,
  className,
}: TemplateVariablesPanelProps) {
  const [isAddingVariable, setIsAddingVariable] = useState(false)
  const [newVariable, setNewVariable] = useState<Partial<TemplateVariable>>({
    name: '',
    placeholder: '',
    type: 'text',
    required: false,
  })

  const addVariable = () => {
    if (!newVariable.name || !newVariable.placeholder) return

    const variable: TemplateVariable = {
      id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newVariable.name,
      placeholder: newVariable.placeholder.startsWith('{{') 
        ? newVariable.placeholder 
        : `{{${newVariable.placeholder}}}`,
      type: newVariable.type || 'text',
      required: newVariable.required || false,
    }

    onVariablesChange([...variables, variable])
    setNewVariable({ name: '', placeholder: '', type: 'text', required: false })
    setIsAddingVariable(false)
  }

  const removeVariable = (variableId: string) => {
    onVariablesChange(variables.filter(v => v.id !== variableId))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const allVariables = [...defaultVariables, ...variables.filter(v => 
    !defaultVariables.some(dv => dv.id === v.id)
  )]

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Template Variables</h3>
          <p className="text-xs text-gray-500 mt-1">
            Click to insert into text blocks
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingVariable(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {/* Default Variables */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Default Variables</h4>
            <div className="space-y-1">
              {defaultVariables.map((variable) => (
                <div
                  key={variable.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {variable.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {variable.type}
                      </Badge>
                    </div>
                    <code className="text-xs text-gray-600 font-mono">
                      {variable.placeholder}
                    </code>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(variable.placeholder)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {onInsertVariable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onInsertVariable(variable)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Variables */}
          {variables.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Custom Variables</h4>
              <div className="space-y-1">
                {variables.map((variable) => (
                  <div
                    key={variable.id}
                    className="flex items-center justify-between p-2 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {variable.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {variable.type}
                        </Badge>
                        {variable.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <code className="text-xs text-gray-600 font-mono">
                        {variable.placeholder}
                      </code>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(variable.placeholder)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {onInsertVariable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onInsertVariable(variable)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => removeVariable(variable.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Variable Form */}
      {isAddingVariable && (
        <div className="mt-4 p-3 border rounded-lg bg-gray-50 space-y-3">
          <h4 className="text-sm font-medium">Add Custom Variable</h4>
          
          <div className="space-y-2">
            <Label htmlFor="varName">Variable Name</Label>
            <Input
              id="varName"
              value={newVariable.name || ''}
              onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Company Name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="varPlaceholder">Placeholder</Label>
            <Input
              id="varPlaceholder"
              value={newVariable.placeholder || ''}
              onChange={(e) => setNewVariable(prev => ({ ...prev, placeholder: e.target.value }))}
              placeholder="company_name"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={addVariable} size="sm">
              Add Variable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingVariable(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}