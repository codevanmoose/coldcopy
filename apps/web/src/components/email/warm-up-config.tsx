'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { TrendingUp, Info, Loader2 } from 'lucide-react'

const warmUpSchema = z.object({
  enabled: z.boolean(),
  startVolume: z.number().min(1).max(100),
  dailyIncrease: z.number().min(1).max(50),
  maxVolume: z.number().min(50).max(5000),
  warmUpDays: z.number().min(7).max(90),
})

type WarmUpConfig = z.infer<typeof warmUpSchema>

interface WarmUpConfigProps {
  workspaceId: string
  currentConfig?: WarmUpConfig
  onSave?: (config: WarmUpConfig) => void
}

export function WarmUpConfig({ workspaceId, currentConfig, onSave }: WarmUpConfigProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<WarmUpConfig>({
    resolver: zodResolver(warmUpSchema),
    defaultValues: currentConfig || {
      enabled: false,
      startVolume: 10,
      dailyIncrease: 10,
      maxVolume: 500,
      warmUpDays: 30,
    },
  })

  const enabled = watch('enabled')
  const startVolume = watch('startVolume')
  const dailyIncrease = watch('dailyIncrease')
  const maxVolume = watch('maxVolume')
  const warmUpDays = watch('warmUpDays')

  // Calculate warm-up schedule preview
  const calculateSchedule = () => {
    const schedule = []
    let currentVolume = startVolume
    
    for (let day = 1; day <= warmUpDays && currentVolume < maxVolume; day++) {
      schedule.push({ day, volume: Math.min(currentVolume, maxVolume) })
      currentVolume += dailyIncrease
    }
    
    return schedule
  }

  const schedule = calculateSchedule()
  const finalVolume = schedule[schedule.length - 1]?.volume || startVolume

  const onSubmit = async (data: WarmUpConfig) => {
    setIsLoading(true)
    try {
      // In a real implementation, save to database
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (onSave) {
        onSave(data)
      }
      
      toast.success('Warm-up configuration saved')
    } catch (error) {
      console.error('Error saving warm-up config:', error)
      toast.error('Failed to save configuration')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Warm-up</CardTitle>
        <CardDescription>
          Gradually increase your sending volume to build sender reputation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Warm-up</Label>
              <p className="text-sm text-muted-foreground">
                Automatically limit daily sending volume
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={(checked) => setValue('enabled', checked, { shouldDirty: true })}
            />
          </div>

          {enabled && (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Email warm-up helps establish your sender reputation by gradually increasing
                  your sending volume over time. This improves deliverability and reduces the
                  risk of being marked as spam.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Starting Volume</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[startVolume]}
                      onValueChange={([value]) => setValue('startVolume', value, { shouldDirty: true })}
                      min={1}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <div className="w-16">
                      <Input
                        type="number"
                        value={startVolume}
                        onChange={(e) => setValue('startVolume', parseInt(e.target.value) || 1, { shouldDirty: true })}
                        min={1}
                        max={100}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Emails per day on day 1
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Daily Increase</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[dailyIncrease]}
                      onValueChange={([value]) => setValue('dailyIncrease', value, { shouldDirty: true })}
                      min={1}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <div className="w-16">
                      <Input
                        type="number"
                        value={dailyIncrease}
                        onChange={(e) => setValue('dailyIncrease', parseInt(e.target.value) || 1, { shouldDirty: true })}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Additional emails per day
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum Volume</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[maxVolume]}
                      onValueChange={([value]) => setValue('maxVolume', value, { shouldDirty: true })}
                      min={50}
                      max={5000}
                      step={50}
                      className="flex-1"
                    />
                    <div className="w-20">
                      <Input
                        type="number"
                        value={maxVolume}
                        onChange={(e) => setValue('maxVolume', parseInt(e.target.value) || 50, { shouldDirty: true })}
                        min={50}
                        max={5000}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Target daily sending limit
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Warm-up Period</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[warmUpDays]}
                      onValueChange={([value]) => setValue('warmUpDays', value, { shouldDirty: true })}
                      min={7}
                      max={90}
                      step={1}
                      className="flex-1"
                    />
                    <div className="w-16">
                      <Input
                        type="number"
                        value={warmUpDays}
                        onChange={(e) => setValue('warmUpDays', parseInt(e.target.value) || 7, { shouldDirty: true })}
                        min={7}
                        max={90}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Days to reach maximum volume
                  </p>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Warm-up Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Day 1</span>
                    <span className="font-medium">{startVolume} emails/day</span>
                  </div>
                  <div className="my-2 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Day {Math.min(warmUpDays, Math.ceil((maxVolume - startVolume) / dailyIncrease))}
                    </span>
                    <span className="font-medium">{finalVolume} emails/day</span>
                  </div>
                  
                  {finalVolume < maxVolume && (
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      Reaches maximum in {Math.ceil((maxVolume - startVolume) / dailyIncrease)} days
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={!isDirty || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}