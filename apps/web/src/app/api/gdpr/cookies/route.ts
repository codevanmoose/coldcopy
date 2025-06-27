import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { cookies } from 'next/headers'

const cookiePreferencesSchema = z.object({
  preferences: z.object({
    necessary: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
    functional: z.boolean(),
  }),
})

const COOKIE_NAME = 'cookie-preferences'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Parse and validate request body
    const body = await request.json()
    const { preferences } = cookiePreferencesSchema.parse(body)

    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser()

    // Set cookie preferences
    const cookieStore = cookies()
    cookieStore.set(COOKIE_NAME, JSON.stringify(preferences), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    // If user is authenticated, save preferences to database
    if (user) {
      // Save cookie preferences
      await supabase
        .from('cookie_preferences')
        .upsert({
          user_id: user.id,
          preferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      // Update consent records
      const consentMappings = [
        { type: 'analytics-cookies', status: preferences.analytics },
        { type: 'marketing-cookies', status: preferences.marketing },
        { type: 'functional-cookies', status: preferences.functional },
      ]

      for (const consent of consentMappings) {
        await supabase
          .from('gdpr_consents')
          .upsert({
            user_id: user.id,
            type: consent.type,
            status: consent.status,
            category: 'cookies',
            metadata: {
              name: `${consent.type.replace('-', ' ')}`,
              description: `Cookie consent for ${consent.type}`,
              required: false,
            },
          }, { onConflict: 'user_id,type' })
      }

      // Log the preference update
      await supabase
        .from('gdpr_audit_logs')
        .insert({
          user_id: user.id,
          action: 'cookie_preferences_updated',
          resource_type: 'cookie_preferences',
          metadata: {
            preferences,
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent'),
          },
        })
    }

    // Update client-side tracking based on preferences
    const trackingResponse: any = {
      success: true,
      preferences,
      tracking: {
        googleAnalytics: preferences.analytics,
        facebookPixel: preferences.marketing,
        hotjar: preferences.analytics && preferences.functional,
        intercom: preferences.functional,
      },
    }

    // Add CSP headers based on preferences
    const headers = new Headers()
    
    if (!preferences.analytics) {
      headers.append('X-Disable-Analytics', 'true')
    }
    
    if (!preferences.marketing) {
      headers.append('X-Disable-Marketing', 'true')
    }

    return NextResponse.json(trackingResponse, { headers })
  } catch (error) {
    console.error('Error in cookie preferences API:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid preferences data', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient()
    
    // Check for existing cookie preferences
    const cookiePrefs = cookieStore.get(COOKIE_NAME)
    
    if (cookiePrefs) {
      try {
        const preferences = JSON.parse(cookiePrefs.value)
        return NextResponse.json({
          success: true,
          preferences,
          source: 'cookie',
        })
      } catch (e) {
        // Invalid cookie data, continue to check database
      }
    }

    // Check if user is authenticated and has saved preferences
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: dbPrefs } = await supabase
        .from('cookie_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (dbPrefs) {
        // Set cookie from database preferences
        cookieStore.set(COOKIE_NAME, JSON.stringify(dbPrefs.preferences), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: COOKIE_MAX_AGE,
          path: '/',
        })

        return NextResponse.json({
          success: true,
          preferences: dbPrefs.preferences,
          source: 'database',
        })
      }
    }

    // Return default preferences (no consent given)
    return NextResponse.json({
      success: true,
      preferences: null,
      source: 'default',
    })
  } catch (error) {
    console.error('Error in cookie preferences GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient()
    
    // Delete cookie
    cookieStore.delete(COOKIE_NAME)

    // If user is authenticated, delete from database
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Delete preferences
      await supabase
        .from('cookie_preferences')
        .delete()
        .eq('user_id', user.id)

      // Update consent records
      await supabase
        .from('gdpr_consents')
        .update({ status: false })
        .eq('user_id', user.id)
        .eq('category', 'cookies')
        .neq('type', 'necessary-cookies')

      // Log the deletion
      await supabase
        .from('gdpr_audit_logs')
        .insert({
          user_id: user.id,
          action: 'cookie_preferences_deleted',
          resource_type: 'cookie_preferences',
          metadata: {
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent'),
          },
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Cookie preferences deleted',
    })
  } catch (error) {
    console.error('Error in cookie preferences DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}