export interface TemplateBlock {
  id: string
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'heading' | 'logo'
  content?: string
  styles?: BlockStyles
  settings?: BlockSettings
}

export interface BlockStyles {
  backgroundColor?: string
  textColor?: string
  fontSize?: string
  fontWeight?: string
  textAlign?: 'left' | 'center' | 'right'
  padding?: string
  margin?: string
  borderRadius?: string
  borderWidth?: string
  borderColor?: string
  borderStyle?: string
  width?: string
  height?: string
}

export interface BlockSettings {
  // Text block settings
  placeholder?: string
  allowVariables?: boolean
  
  // Image block settings
  src?: string
  alt?: string
  
  // Button block settings
  href?: string
  target?: '_blank' | '_self'
  
  // Spacer block settings
  spacing?: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject?: string
  blocks: TemplateBlock[]
  globalStyles?: {
    backgroundColor?: string
    fontFamily?: string
    maxWidth?: string
  }
  variables?: TemplateVariable[]
  createdAt: Date
  updatedAt: Date
}

export interface TemplateVariable {
  id: string
  name: string
  placeholder: string
  required?: boolean
  type?: 'text' | 'email' | 'url' | 'number'
}

export interface BlockType {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  defaultContent?: string
  defaultStyles?: BlockStyles
  defaultSettings?: BlockSettings
}

export interface DevicePreview {
  type: 'desktop' | 'mobile'
  width: string
  height: string
}