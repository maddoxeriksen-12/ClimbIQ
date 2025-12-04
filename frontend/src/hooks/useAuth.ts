import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'athlete' | 'coach'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signInWithGoogle = async (role?: UserRole) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
        queryParams: role ? { user_role: role } : undefined,
      },
    })
    if (error) throw error
  }

  // Check if user needs onboarding
  const needsOnboarding = (): boolean => {
    return user !== null && !user.user_metadata?.onboarding_completed
  }

  const signUp = async (email: string, password: string, fullName: string, role: UserRole = 'athlete') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: fullName,
          role: role,
        },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateUserRole = async (role: UserRole) => {
    const { error } = await supabase.auth.updateUser({
      data: { role }
    })
    if (error) throw error
  }

  // Helper to get user role
  const getUserRole = (): UserRole => {
    return user?.user_metadata?.role || 'athlete'
  }

  const isCoach = () => getUserRole() === 'coach'

  return { 
    user, 
    session, 
    loading, 
    signIn, 
    signInWithGoogle, 
    signUp, 
    signOut,
    updateUserRole,
    getUserRole,
    isCoach,
    needsOnboarding,
  }
}
