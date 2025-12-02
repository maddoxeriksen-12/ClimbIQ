import { create } from 'zustand'
import { api } from '../lib/api'

interface Recommendation {
  id: string
  recommendation_type: string
  title: string
  description: string
  reasoning?: string
  confidence_score?: number
  was_followed?: boolean
  user_rating?: number
}

interface RecommendationStore {
  recommendations: Recommendation[]
  loading: boolean

  fetchPreSessionRecommendations: () => Promise<void>
  submitFeedback: (id: string, feedback: any) => Promise<void>
}

export const useRecommendationStore = create<RecommendationStore>((set) => ({
  recommendations: [],
  loading: false,

  fetchPreSessionRecommendations: async () => {
    set({ loading: true })
    try {
      const response = await api.get('/api/v1/recommendations/pre-session')
      set({ recommendations: response.data, loading: false })
    } catch (error) {
      set({ loading: false })
    }
  },

  submitFeedback: async (id, feedback) => {
    try {
      await api.patch(`/api/v1/recommendations/${id}/feedback`, feedback)
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id ? { ...r, ...feedback } : r,
        ),
      }))
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  },
}))


