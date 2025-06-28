import { createClient } from '@/lib/supabase/client'

// NextAuth configuration placeholder
// In production, this would be a proper NextAuth configuration
// For now, we're using Supabase Auth directly
export const authOptions = {
  providers: [],
  callbacks: {},
}

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}