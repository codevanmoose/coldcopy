import { TemplateVariable } from './types'

export const defaultVariables: TemplateVariable[] = [
  {
    id: 'first_name',
    name: 'First Name',
    placeholder: '{{first_name}}',
    required: false,
    type: 'text',
  },
  {
    id: 'last_name',
    name: 'Last Name',
    placeholder: '{{last_name}}',
    required: false,
    type: 'text',
  },
  {
    id: 'email',
    name: 'Email',
    placeholder: '{{email}}',
    required: false,
    type: 'email',
  },
  {
    id: 'company',
    name: 'Company',
    placeholder: '{{company}}',
    required: false,
    type: 'text',
  },
  {
    id: 'position',
    name: 'Position',
    placeholder: '{{position}}',
    required: false,
    type: 'text',
  },
  {
    id: 'website',
    name: 'Website',
    placeholder: '{{website}}',
    required: false,
    type: 'url',
  },
  {
    id: 'phone',
    name: 'Phone',
    placeholder: '{{phone}}',
    required: false,
    type: 'text',
  },
]

export function insertVariable(text: string, variable: TemplateVariable): string {
  return text + variable.placeholder
}

export function getVariablesFromText(text: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g
  const matches = []
  let match
  
  while ((match = variableRegex.exec(text)) !== null) {
    matches.push(match[1])
  }
  
  return matches
}

export function replaceVariables(text: string, values: Record<string, string>): string {
  let result = text
  
  Object.entries(values).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), value)
  })
  
  return result
}