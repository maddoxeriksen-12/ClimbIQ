import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useRecommendationStore } from '../stores/recommendationStore'

interface PreSessionData {
  energy_level: number
  motivation: number
  stress_level: number
  sleep_quality: number
  sleep_hours: number
  soreness: Record<string, number>
  notes: string
}

export function PreSessionForm() {
  const { createSession } = useSessionStore()
  const { recommendations, fetchPreSessionRecommendations } =
    useRecommendationStore()

  const [formData, setFormData] = useState<PreSessionData>({
    energy_level: 5,
    motivation: 5,
    stress_level: 5,
    sleep_quality: 5,
    sleep_hours: 7,
    soreness: {},
    notes: '',
  })

  const [sessionType, setSessionType] = useState('bouldering')
  const [location, setLocation] = useState('')

  // Fetch recommendations when component mounts
  useState(() => {
    void fetchPreSessionRecommendations()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await createSession({
      session_date: new Date().toISOString().split('T')[0],
      session_type: sessionType,
      location,
      pre_session: formData,
    })
  }

  const RatingSlider = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: number
    onChange: (v: number) => void
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">
        {label}: {value}/10
      </label>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Start Session</h2>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-3">Personalized Tips</h3>
          {recommendations.map((rec) => (
            <div key={rec.id} className="mb-3 p-3 bg-white rounded">
              <p className="font-medium">{rec.title}</p>
              <p className="text-sm text-gray-600">{rec.description}</p>
              {rec.confidence_score && (
                <p className="text-xs text-gray-400 mt-1">
                  Confidence: {(rec.confidence_score * 100).toFixed(0)}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Session Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Session Type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="bouldering">Bouldering</option>
            <option value="sport">Sport Climbing</option>
            <option value="trad">Trad Climbing</option>
            <option value="training">Training</option>
          </select>
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Gym or crag name"
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Pre-session ratings */}
        <RatingSlider
          label="Energy Level"
          value={formData.energy_level}
          onChange={(v) => setFormData({ ...formData, energy_level: v })}
        />

        <RatingSlider
          label="Motivation"
          value={formData.motivation}
          onChange={(v) => setFormData({ ...formData, motivation: v })}
        />

        <RatingSlider
          label="Stress Level"
          value={formData.stress_level}
          onChange={(v) => setFormData({ ...formData, stress_level: v })}
        />

        <RatingSlider
          label="Sleep Quality"
          value={formData.sleep_quality}
          onChange={(v) => setFormData({ ...formData, sleep_quality: v })}
        />

        {/* Sleep hours */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Hours of Sleep: {formData.sleep_hours}
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="14"
            value={formData.sleep_hours}
            onChange={(e) =>
              setFormData({
                ...formData,
                sleep_hours: parseFloat(e.target.value),
              })
            }
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Anything else relevant..."
            className="w-full p-2 border rounded h-24"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Start Climbing Session
        </button>
      </form>
    </div>
  )
}


