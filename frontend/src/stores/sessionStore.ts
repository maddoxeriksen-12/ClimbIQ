import { create } from 'zustand'
import { api } from '../lib/api'

interface ClimbingSession {
  id: string
  session_date: string
  session_type: string
  location?: string
  pre_energy_level?: number
  pre_motivation?: number
  post_performance_rating?: number
}

interface SessionStore {
  sessions: ClimbingSession[]
  currentSession: ClimbingSession | null
  loading: boolean
  error: string | null

  fetchSessions: () => Promise<void>
  createSession: (data: any) => Promise<ClimbingSession>
  completeSession: (sessionId: string, data: any) => Promise<void>
  setCurrentSession: (session: ClimbingSession | null) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/api/v1/sessions')
      set({ sessions: response.data, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  createSession: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await api.post('/api/v1/sessions', data)
      const newSession = response.data
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSession: newSession,
        loading: false,
      }))
      return newSession
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  completeSession: async (sessionId, data) => {
    set({ loading: true, error: null })
    try {
      const response = await api.patch(
        `/api/v1/sessions/${sessionId}/complete`,
        data,
      )
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? response.data : s,
        ),
        currentSession: null,
        loading: false,
      }))
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  setCurrentSession: (session) => set({ currentSession: session }),
}))

import { create } from 'zustand'
import { api } from '../lib/api'

interface ClimbingSession {
  id: string
  session_date: string
  session_type: string
  location?: string
  pre_energy_level?: number
  pre_motivation?: number
  post_performance_rating?: number
}

interface SessionStore {
  sessions: ClimbingSession[]
  currentSession: ClimbingSession | null
  loading: boolean
  error: string | null

  fetchSessions: () => Promise<void>
  createSession: (data: any) => Promise<ClimbingSession>
  completeSession: (sessionId: string, data: any) => Promise<void>
  setCurrentSession: (session: ClimbingSession | null) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/api/v1/sessions')
      set({ sessions: response.data, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  createSession: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await api.post('/api/v1/sessions', data)
      const newSession = response.data
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSession: newSession,
        loading: false,
      }))
      return newSession
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  completeSession: async (sessionId, data) => {
    set({ loading: true, error: null })
    try {
      const response = await api.patch(
        `/api/v1/sessions/${sessionId}/complete`,
        data,
      )
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? response.data : s,
        ),
        currentSession: null,
        loading: false,
      }))
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  setCurrentSession: (session) => set({ currentSession: session }),
}))


