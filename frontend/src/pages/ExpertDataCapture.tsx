import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  getScenarios,
  getExpertDataStats,
  getMyResponseForScenario,
  upsertExpertResponse,
  updateScenario,
  getRules,
  type SyntheticScenario,
  type ExpertScenarioResponse,
  type ExpertRule,
  type SessionType,
  type CreateExpertResponseInput,
} from '../lib/expertDataService'

type TabType = 'scenarios' | 'rules' | 'sessions'
type ScenarioFilter = 'all' | 'pending' | 'in_review' | 'consensus_reached' | 'disputed'

interface Stats {
  totalScenarios: number
  pendingScenarios: number
  reviewedScenarios: number
  totalResponses: number
  completeResponses: number
  totalRules: number
  activeRules: number
}

export function ExpertDataCapture() {
  const { user, isCoach } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('scenarios')
  const [scenarios, setScenarios] = useState<SyntheticScenario[]>([])
  const [rules, setRules] = useState<ExpertRule[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioFilter>('pending')
  
  // Selected scenario for review
  const [selectedScenario, setSelectedScenario] = useState<SyntheticScenario | null>(null)
  const [existingResponse, setExistingResponse] = useState<ExpertScenarioResponse | null>(null)
  const [responseStartTime, setResponseStartTime] = useState<Date | null>(null)

  const expertId = user?.id || ''

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [scenariosResult, rulesResult, statsResult] = await Promise.all([
        getScenarios({ status: scenarioFilter === 'all' ? undefined : scenarioFilter, limit: 50 }),
        getRules({ is_active: true }),
        getExpertDataStats(),
      ])

      if (scenariosResult.data) setScenarios(scenariosResult.data)
      if (rulesResult.data) setRules(rulesResult.data)
      if (statsResult.data) setStats(statsResult.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
    setLoading(false)
  }, [scenarioFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // When a scenario is selected, check for existing response
  useEffect(() => {
    async function checkExistingResponse() {
      if (selectedScenario && expertId) {
        const { data } = await getMyResponseForScenario(selectedScenario.id, expertId)
        setExistingResponse(data)
        setResponseStartTime(new Date())
      }
    }
    checkExistingResponse()
  }, [selectedScenario, expertId])

  // Check if user is coach or admin
  if (!isCoach()) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <span className="text-4xl mb-4 block">🔒</span>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-slate-400">
            The Expert Data Capture system is only available to coaches and administrators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl">
            🧠
          </div>
          <div>
            <h1 className="text-3xl font-bold">Expert Data Capture</h1>
            <p className="text-slate-400">Review scenarios and provide structured feedback for Bayesian priors</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard label="Total Scenarios" value={stats.totalScenarios} icon="📋" />
          <StatCard label="Pending Review" value={stats.pendingScenarios} icon="⏳" highlight />
          <StatCard label="Reviewed" value={stats.reviewedScenarios} icon="✅" />
          <StatCard label="Total Responses" value={stats.totalResponses} icon="💬" />
          <StatCard label="Complete" value={stats.completeResponses} icon="📝" />
          <StatCard label="Total Rules" value={stats.totalRules} icon="📜" />
          <StatCard label="Active Rules" value={stats.activeRules} icon="⚡" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {[
          { id: 'scenarios' as TabType, label: 'Scenario Review', icon: '🎯' },
          { id: 'rules' as TabType, label: 'Expert Rules', icon: '📜' },
          { id: 'sessions' as TabType, label: 'Review Sessions', icon: '📅' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-violet-500/20 text-violet-300'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'scenarios' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scenario List */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Scenarios</h2>
                <button
                  onClick={fetchData}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
              
              {/* Filter Pills */}
              <div className="flex gap-2 flex-wrap">
                {(['all', 'pending', 'in_review', 'consensus_reached', 'disputed'] as ScenarioFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setScenarioFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      scenarioFilter === filter
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-8 h-8 mx-auto rounded-full border-2 border-violet-500 border-t-transparent animate-spin mb-2" />
                  Loading scenarios...
                </div>
              ) : scenarios.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="text-4xl mb-4 block">📭</span>
                  <p className="text-slate-400">No scenarios found</p>
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <ScenarioListItem
                    key={scenario.id}
                    scenario={scenario}
                    isSelected={selectedScenario?.id === scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Scenario Review Panel */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            {selectedScenario ? (
              <ScenarioReviewPanel
                scenario={selectedScenario}
                existingResponse={existingResponse}
                expertId={expertId}
                responseStartTime={responseStartTime}
                onResponseSaved={() => {
                  fetchData()
                  setSelectedScenario(null)
                }}
                onClose={() => setSelectedScenario(null)}
              />
            ) : (
              <div className="p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                <span className="text-6xl mb-4">👈</span>
                <h3 className="text-lg font-semibold mb-2">Select a Scenario</h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  Choose a scenario from the list to review and provide your expert feedback.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <RulesTab rules={rules} onRefresh={fetchData} />
      )}

      {activeTab === 'sessions' && (
        <ReviewSessionsTab />
      )}
    </div>
  )
}

// ==================== Sub-components ====================

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

function ScenarioListItem({ 
  scenario, 
  isSelected, 
  onClick 
}: { 
  scenario: SyntheticScenario
  isSelected: boolean
  onClick: () => void 
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-300',
    in_review: 'bg-blue-500/20 text-blue-300',
    consensus_reached: 'bg-emerald-500/20 text-emerald-300',
    disputed: 'bg-red-500/20 text-red-300',
    needs_discussion: 'bg-violet-500/20 text-violet-300',
    archived: 'bg-slate-500/20 text-slate-300',
  }

  const difficultyIcons: Record<string, string> = {
    common: '🟢',
    edge_case: '🟡',
    extreme: '🔴',
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left transition-all hover:bg-white/5 ${
        isSelected ? 'bg-violet-500/10 border-l-2 border-violet-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[scenario.status]}`}>
          {scenario.status.replace('_', ' ')}
        </span>
        <span className="text-sm" title={scenario.difficulty_level || 'common'}>
          {difficultyIcons[scenario.difficulty_level || 'common']}
        </span>
      </div>
      
      <p className="text-sm text-slate-300 line-clamp-2 mb-2">
        {scenario.scenario_description || 'No description'}
      </p>
      
      {scenario.edge_case_tags && scenario.edge_case_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scenario.edge_case_tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-xs text-slate-400">
              {tag}
            </span>
          ))}
          {scenario.edge_case_tags.length > 3 && (
            <span className="text-xs text-slate-500">+{scenario.edge_case_tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

function ScenarioReviewPanel({
  scenario,
  existingResponse,
  expertId,
  responseStartTime,
  onResponseSaved,
  onClose,
}: {
  scenario: SyntheticScenario
  existingResponse: ExpertScenarioResponse | null
  expertId: string
  responseStartTime: Date | null
  onResponseSaved: () => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [showAiSuggestion, setShowAiSuggestion] = useState(false)
  
  // Form state
  const [qualityOptimal, setQualityOptimal] = useState(existingResponse?.predicted_quality_optimal || 5)
  const [qualityBaseline, setQualityBaseline] = useState(existingResponse?.predicted_quality_baseline || 5)
  const [predictionConfidence, setPredictionConfidence] = useState<'high' | 'medium' | 'low'>(existingResponse?.prediction_confidence || 'medium')
  const [sessionType, setSessionType] = useState<SessionType | ''>(existingResponse?.recommended_session_type || '')
  const [sessionTypeConfidence, setSessionTypeConfidence] = useState<'high' | 'medium' | 'low'>(existingResponse?.session_type_confidence || 'medium')
  const [agreesWithAi, setAgreesWithAi] = useState<'yes' | 'partially' | 'no' | ''>(existingResponse?.agrees_with_ai || '')
  const [reasoning, setReasoning] = useState(existingResponse?.reasoning || '')
  const [keyDrivers, _setKeyDrivers] = useState<string[]>([]) // TODO: Add UI for key drivers

  // Update form when existing response changes
  useEffect(() => {
    if (existingResponse) {
      setQualityOptimal(existingResponse.predicted_quality_optimal || 5)
      setQualityBaseline(existingResponse.predicted_quality_baseline || 5)
      setPredictionConfidence(existingResponse.prediction_confidence || 'medium')
      setSessionType(existingResponse.recommended_session_type || '')
      setSessionTypeConfidence(existingResponse.session_type_confidence || 'medium')
      setAgreesWithAi(existingResponse.agrees_with_ai || '')
      setReasoning(existingResponse.reasoning || '')
    }
  }, [existingResponse])

  const handleSave = async (isComplete: boolean) => {
    setSaving(true)
    
    const durationSec = responseStartTime 
      ? Math.floor((new Date().getTime() - responseStartTime.getTime()) / 1000)
      : null

    const input: CreateExpertResponseInput = {
      scenario_id: scenario.id,
      expert_id: expertId,
      predicted_quality_optimal: qualityOptimal,
      predicted_quality_baseline: qualityBaseline,
      prediction_confidence: predictionConfidence,
      recommended_session_type: sessionType || undefined,
      session_type_confidence: sessionTypeConfidence,
      agrees_with_ai: agreesWithAi || undefined,
      reasoning,
      key_drivers: keyDrivers.map(d => ({ factor: d, direction: 'positive', magnitude: 'medium', reasoning: '' })),
      response_duration_sec: durationSec || undefined,
      is_complete: isComplete,
    }

    const { error } = await upsertExpertResponse(input)
    
    if (error) {
      alert('Failed to save response. Please try again.')
    } else {
      // Update scenario status if needed
      if (scenario.status === 'pending') {
        await updateScenario(scenario.id, { status: 'in_review' })
      }
      onResponseSaved()
    }
    
    setSaving(false)
  }

  const sessionTypes: { value: SessionType; label: string; icon: string }[] = [
    { value: 'project', label: 'Project Session', icon: '🎯' },
    { value: 'limit_bouldering', label: 'Limit Bouldering', icon: '💪' },
    { value: 'volume', label: 'Volume', icon: '📊' },
    { value: 'technique', label: 'Technique', icon: '🎨' },
    { value: 'training', label: 'Training', icon: '🏋️' },
    { value: 'light_session', label: 'Light Session', icon: '🌤️' },
    { value: 'rest_day', label: 'Rest Day', icon: '😴' },
    { value: 'active_recovery', label: 'Active Recovery', icon: '🧘' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-semibold">Review Scenario</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Scenario Info */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <span>📋</span> Scenario Details
          </h3>
          <p className="text-sm text-slate-300 mb-4">{scenario.scenario_description || 'No description'}</p>
          
          {/* Baseline Snapshot */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Baseline Assessment</h4>
            <pre className="text-xs bg-black/20 rounded-lg p-3 overflow-x-auto max-h-32">
              {JSON.stringify(scenario.baseline_snapshot, null, 2)}
            </pre>
          </div>

          {/* Pre-Session Snapshot */}
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Pre-Session State</h4>
            <pre className="text-xs bg-black/20 rounded-lg p-3 overflow-x-auto max-h-32">
              {JSON.stringify(scenario.pre_session_snapshot, null, 2)}
            </pre>
          </div>
        </div>

        {/* AI Suggestion (Collapsible) */}
        {scenario.ai_recommendation && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
            <button
              onClick={() => setShowAiSuggestion(!showAiSuggestion)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-medium flex items-center gap-2">
                <span>🤖</span> AI Suggestion
              </h3>
              <span className="text-sm text-cyan-400">{showAiSuggestion ? '▲ Hide' : '▼ Show'}</span>
            </button>
            
            {showAiSuggestion && (
              <div className="mt-3 space-y-2">
                <pre className="text-xs bg-black/20 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(scenario.ai_recommendation, null, 2)}
                </pre>
                {scenario.ai_reasoning && (
                  <p className="text-sm text-slate-300">{scenario.ai_reasoning}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Response Form */}
        <div className="space-y-6">
          {/* Quality Predictions */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <span>📈</span> Outcome Predictions
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="text-slate-300">Expected Quality (with optimal recommendation)</label>
                  <span className="text-emerald-400 font-medium">{qualityOptimal}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={qualityOptimal}
                  onChange={(e) => setQualityOptimal(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="text-slate-300">Expected Quality (with baseline/no intervention)</label>
                  <span className="text-amber-400 font-medium">{qualityBaseline}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={qualityBaseline}
                  onChange={(e) => setQualityBaseline(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Prediction Confidence</label>
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setPredictionConfidence(level)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                        predictionConfidence === level
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Session Type Recommendation */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <span>🎯</span> Recommended Session Type
            </h3>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              {sessionTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSessionType(type.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    sessionType === type.value
                      ? 'bg-violet-500/20 border border-violet-500/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm text-slate-300 block mb-2">Session Type Confidence</label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSessionTypeConfidence(level)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      sessionTypeConfidence === level
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Agreement */}
          {scenario.ai_recommendation && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <span>🤝</span> Agreement with AI
              </h3>
              <div className="flex gap-2">
                {[
                  { value: 'yes' as const, label: 'Agree', color: 'emerald' },
                  { value: 'partially' as const, label: 'Partially', color: 'amber' },
                  { value: 'no' as const, label: 'Disagree', color: 'red' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAgreesWithAi(option.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      agreesWithAi === option.value
                        ? option.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : option.color === 'amber' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <span>💭</span> Reasoning
            </h3>
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="Explain your reasoning for this recommendation..."
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !sessionType}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Submit Response'}
        </button>
      </div>
    </div>
  )
}

function RulesTab({ rules, onRefresh }: { rules: ExpertRule[]; onRefresh: () => void }) {
  const categoryColors: Record<string, string> = {
    safety: 'bg-red-500/20 text-red-300 border-red-500/30',
    interaction: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    edge_case: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    conservative: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    performance: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-semibold">Expert Rules</h2>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
        {rules.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-4xl mb-4 block">📜</span>
            <p className="text-slate-400">No rules defined yet</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="p-4 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColors[rule.rule_category]}`}>
                    {rule.rule_category}
                  </span>
                  <span className="text-xs text-slate-500">Priority: {rule.priority}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${rule.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>
                  {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <h3 className="font-medium mb-1">{rule.name}</h3>
              <p className="text-sm text-slate-400 mb-3">{rule.description}</p>
              
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-white/5 text-slate-400">
                  Source: {rule.source}
                </span>
                {rule.confidence && (
                  <span className="px-2 py-1 rounded bg-white/5 text-slate-400">
                    Confidence: {rule.confidence}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ReviewSessionsTab() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center">
      <span className="text-4xl mb-4 block">🚧</span>
      <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        Review session management will allow you to organize structured review sessions with multiple experts.
      </p>
    </div>
  )
}

