'use client'

import React, { useState, useEffect } from 'react'
import { Input } from './input'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Label } from './label'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

const defaultColors = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#808080', '#800080', '#008000', '#808000', '#000080', '#008080', '#c0c0c0',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
  '#00d2d3', '#ff9f43', '#10ac84', '#ee5a6f', '#0abde3', '#3742fa', '#2f3542', '#747d8c',
]

export function ColorPicker({ value, onChange, label, className, disabled }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue)
    if (isValidColor(newValue)) {
      onChange(newValue)
    }
  }

  const handleInputBlur = () => {
    if (isValidColor(inputValue)) {
      onChange(inputValue)
    } else {
      setInputValue(value) // Reset to original value if invalid
    }
  }

  const handleColorSelect = (color: string) => {
    setInputValue(color)
    onChange(color)
    setIsOpen(false)
  }

  const isValidColor = (color: string): boolean => {
    // Check if it's a valid hex color
    return /^#([0-9A-F]{3}){1,2}$/i.test(color)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-12 h-10 p-0 border-2"
              style={{ backgroundColor: isValidColor(inputValue) ? inputValue : '#ffffff' }}
              disabled={disabled}
              type="button"
            >
              <span className="sr-only">Pick color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Color</Label>
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onBlur={handleInputBlur}
                  placeholder="#000000"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Presets</Label>
                <div className="grid grid-cols-8 gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className="w-6 h-6 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      type="button"
                    >
                      <span className="sr-only">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          placeholder="#000000"
          className="font-mono flex-1"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

// Utility function to get contrasting text color
export function getContrastingColor(backgroundColor: string): string {
  // Remove # if present
  const color = backgroundColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16)
  const g = parseInt(color.substring(2, 4), 16)
  const b = parseInt(color.substring(4, 6), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// Color utility functions
export const colorUtils = {
  isValidHex: (color: string): boolean => /^#([0-9A-F]{3}){1,2}$/i.test(color),
  
  hexToRgb: (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  },
  
  rgbToHex: (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  },
  
  lighten: (color: string, amount: number): string => {
    const rgb = colorUtils.hexToRgb(color)
    if (!rgb) return color
    
    const newR = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * amount))
    const newG = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * amount))
    const newB = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * amount))
    
    return colorUtils.rgbToHex(newR, newG, newB)
  },
  
  darken: (color: string, amount: number): string => {
    const rgb = colorUtils.hexToRgb(color)
    if (!rgb) return color
    
    const newR = Math.max(0, Math.floor(rgb.r * (1 - amount)))
    const newG = Math.max(0, Math.floor(rgb.g * (1 - amount)))
    const newB = Math.max(0, Math.floor(rgb.b * (1 - amount)))
    
    return colorUtils.rgbToHex(newR, newG, newB)
  }
}