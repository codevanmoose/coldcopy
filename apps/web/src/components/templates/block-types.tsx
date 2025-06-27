import { 
  Type, 
  Image, 
  MousePointer, 
  Minus, 
  Space, 
  Heading1,
  Building2
} from 'lucide-react'
import { BlockType } from './types'

export const blockTypes: BlockType[] = [
  {
    id: 'text',
    name: 'Text',
    icon: Type,
    description: 'Add text content with formatting options',
    defaultContent: 'Your text content here...',
    defaultStyles: {
      fontSize: '16px',
      textColor: '#000000',
      textAlign: 'left',
      padding: '16px',
    },
    defaultSettings: {
      placeholder: 'Enter your text...',
      allowVariables: true,
    },
  },
  {
    id: 'heading',
    name: 'Heading',
    icon: Heading1,
    description: 'Add a heading with customizable styles',
    defaultContent: 'Your heading here',
    defaultStyles: {
      fontSize: '24px',
      fontWeight: 'bold',
      textColor: '#000000',
      textAlign: 'left',
      padding: '16px',
    },
    defaultSettings: {
      placeholder: 'Enter your heading...',
      allowVariables: true,
    },
  },
  {
    id: 'image',
    name: 'Image',
    icon: Image,
    description: 'Add images with customizable dimensions',
    defaultStyles: {
      width: '100%',
      textAlign: 'center',
      padding: '16px',
    },
    defaultSettings: {
      src: 'https://via.placeholder.com/600x200',
      alt: 'Placeholder image',
    },
  },
  {
    id: 'button',
    name: 'Button',
    icon: MousePointer,
    description: 'Add clickable buttons with custom styling',
    defaultContent: 'Click Here',
    defaultStyles: {
      backgroundColor: '#007bff',
      textColor: '#ffffff',
      fontSize: '16px',
      fontWeight: 'bold',
      padding: '12px 24px',
      borderRadius: '4px',
      textAlign: 'center',
      margin: '16px auto',
    },
    defaultSettings: {
      href: '#',
      target: '_blank',
    },
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: Minus,
    description: 'Add horizontal lines to separate content',
    defaultStyles: {
      borderColor: '#e0e0e0',
      borderWidth: '1px',
      margin: '16px 0',
    },
  },
  {
    id: 'spacer',
    name: 'Spacer',
    icon: Space,
    description: 'Add vertical spacing between elements',
    defaultStyles: {
      height: '20px',
    },
    defaultSettings: {
      spacing: '20px',
    },
  },
  {
    id: 'logo',
    name: 'Logo',
    icon: Building2,
    description: 'Add your company logo',
    defaultStyles: {
      width: '200px',
      textAlign: 'center',
      padding: '16px',
    },
    defaultSettings: {
      src: 'https://via.placeholder.com/200x60',
      alt: 'Company logo',
    },
  },
]