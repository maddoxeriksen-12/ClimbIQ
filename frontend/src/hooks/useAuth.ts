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
    // 1) Update auth.user metadata (used by frontend)
    const { error } = await supabase.auth.updateUser({
      data: { role }
    })
    if (error) throw error

    // 2) Keep public.profiles table in sync so backend / analytics can rely on it
    //    RLS already allows users to insert/update their own profile.
    const currentUser = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : user
    const targetUser = currentUser ?? user

    if (targetUser) {
      // TypeScript's Supabase typings can be overly strict here; cast to any to avoid
      // build-time errors while still keeping the runtime behavior correct.
      const { error: profileError } = await (supabase
        .from('profiles') as any).upsert(
        {
          id: targetUser.id,
          full_name: targetUser.user_metadata?.full_name ?? null,
          role,
        },
        { onConflict: 'id' }
      )

      if (profileError) throw profileError
    }
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
