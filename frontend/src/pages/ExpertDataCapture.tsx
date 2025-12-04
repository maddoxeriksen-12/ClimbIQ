import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  getScenarios,
  getExpertDataStats,
  getMyResponseForScenario,
  upsertExpertResponse,
  updateScenario,
  createScenario,
  getRules,
  generateScenariosWithAI,
  checkAIStatus,
  type SyntheticScenario,
  type ExpertScenarioResponse,
  type ExpertRule,
  type SessionType,
  type CreateExpertResponseInput,
  type CreateScenarioInput,
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
  
  // Create scenario modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // AI Generation
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiGenerationCount, setAiGenerationCount] = useState(5)
  const [showAIOptions, setShowAIOptions] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; preview: string } | null>(null)

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

  // Check AI status when opening options
  const handleOpenAIOptions = async () => {
    setShowAIOptions(true)
    
    // Check AI status
    const { data } = await checkAIStatus()
    if (data) {
      setAiStatus({ configured: data.ai_configured, preview: data.api_key_preview })
    }
  }

  // AI Generation handler
  const handleGenerateWithAI = async () => {
    setIsGeneratingAI(true)
    setShowAIOptions(false)
    
    try {
      const { data, error } = await generateScenariosWithAI({
        count: aiGenerationCount,
      })
      
      if (error) {
        alert(`Failed to generate scenarios:\n\n${error.message}`)
      } else if (data) {
        alert(`✅ Generated ${data.scenarios_generated} scenarios!\nBatch: ${data.generation_batch}`)
        fetchData() // Refresh the list
      }
    } catch (err) {
      alert(`Error: ${err}`)
    }
    
    setIsGeneratingAI(false)
  }

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
                <div className="flex items-center gap-2">
                  {/* AI Generation Button */}
                  <div className="relative">
                    <button
                      onClick={() => showAIOptions ? setShowAIOptions(false) : handleOpenAIOptions()}
                      disabled={isGeneratingAI}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 text-xs font-medium hover:from-cyan-500/30 hover:to-violet-500/30 transition-all border border-cyan-500/30 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingAI ? (
                        <>
                          <span className="w-3 h-3 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          🤖 Generate with AI
                        </>
                      )}
                    </button>
                    
                    {/* AI Options Dropdown */}
                    {showAIOptions && !isGeneratingAI && (
                      <div className="absolute top-full right-0 mt-2 w-72 p-4 rounded-xl border border-white/10 bg-[#0f1312] shadow-2xl z-50">
                        <h4 className="text-sm font-medium mb-3">AI Generation Options</h4>
                        
                        {/* AI Status */}
                        {aiStatus && (
                          <div className={`mb-4 p-2 rounded-lg text-xs ${
                            aiStatus.configured 
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                              : 'bg-red-500/10 border border-red-500/30 text-red-300'
                          }`}>
                            {aiStatus.configured ? (
                              <>✓ API Key: {aiStatus.preview}</>
                            ) : (
                              <>⚠ GROK_API_KEY not configured in Railway</>
                            )}
                          </div>
                        )}
                        
                        <div className="mb-4">
                          <label className="text-xs text-slate-400 mb-2 block">Number of scenarios</label>
                          <div className="flex gap-2">
                            {[3, 5, 10].map((n) => (
                              <button
                                key={n}
                                onClick={() => setAiGenerationCount(n)}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  aiGenerationCount === n
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <button
                          onClick={handleGenerateWithAI}
                          disabled={aiStatus !== null && !aiStatus.configured}
                          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-sm font-medium shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Generate {aiGenerationCount} Scenarios
                        </button>
                        
                        <p className="text-xs text-slate-500 mt-3 text-center">
                          Powered by Grok AI (grok-2-1212)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-colors"
                  >
                    + Manual
                  </button>
                  <button
                    onClick={fetchData}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    🔄 Refresh
                  </button>
                </div>
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

          {/* Placeholder for selected scenario */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
              {selectedScenario ? (
                <>
                  <span className="text-6xl mb-4">📋</span>
                  <h3 className="text-lg font-semibold mb-2">Reviewing: {selectedScenario.scenario_description?.slice(0, 50) || 'Scenario'}...</h3>
                  <p className="text-slate-400 text-sm max-w-xs mb-4">
                    Full-screen review panel is open
                  </p>
                  <button
                    onClick={() => setSelectedScenario(null)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-slate-300 text-sm hover:bg-white/20 transition-colors"
                  >
                    Close Review
                  </button>
                </>
              ) : (
                <>
                  <span className="text-6xl mb-4">👈</span>
                  <h3 className="text-lg font-semibold mb-2">Select a Scenario</h3>
                  <p className="text-slate-400 text-sm max-w-xs">
                    Choose a scenario from the list to review and provide your expert feedback.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <RulesTab rules={rules} onRefresh={fetchData} />
      )}

      {activeTab === 'sessions' && (
        <ReviewSessionsTab />
      )}

      {/* Create Scenario Modal */}
      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchData()
          }}
        />
      )}

      {/* Full-Screen Scenario Review Panel - Rendered OUTSIDE the grid */}
      {selectedScenario && (
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

// ================== TYPES FOR REVIEW INTERFACE ==================

interface Counterfactual {
  variable: string
  actualValue: number
  counterfactualValue: number
  newPredictedQuality: number
  wouldChangeSessionType: boolean
  newSessionType?: SessionType
}

interface KeyDriver {
  rank: number
  variable: string
  direction: 'positive' | 'negative'
}

interface InteractionEffect {
  variables: string[]
  description: string
  recommendationWithout: string
  recommendationWith: string
}

interface TreatmentRec {
  value: string
  importance: 'critical' | 'helpful' | 'neutral' | 'avoid'
}

interface SessionActivity {
  id: string
  type: 'warmup' | 'projecting' | 'limit_bouldering' | 'volume' | 'technique' | 'hangboard' | 'campus' | 'stretching' | 'cooldown' | 'antagonist' | 'cardio' | 'core' | 'custom'
  durationMin: number
  intensity?: 'very_light' | 'light' | 'moderate' | 'high' | 'max'
  notes?: string
}

interface SessionStructure {
  warmup: {
    durationMin: number
    includeMobility: boolean
    includeTraversing: boolean
    intensity: 'very_light' | 'light' | 'moderate'
  }
  mainSession: {
    focus: 'limit_attempts' | 'project_burns' | 'volume' | 'technique_drills'
    durationMin: number
    restBetweenAttempts: 'short' | 'medium' | 'long'
    stopCondition: 'time_limit' | 'energy_drop' | 'skin_limit' | 'send_progress'
  }
  hangboard: {
    include: boolean
    contraindicated: boolean
    structure?: 'max_hangs' | 'repeaters' | 'density_hangs'
    volume?: 'reduced' | 'normal' | 'extended'
    rationale?: string
  }
  cooldownDurationMin: number
  antagonistWork: boolean
  activities: SessionActivity[]
}

const AVAILABLE_VARIABLES = [
  'sleep_quality', 'sleep_hours', 'energy_level', 'motivation', 'stress_level',
  'muscle_soreness', 'days_since_last_session', 'days_since_rest_day', 'caffeine_today',
  'alcohol_last_24h', 'performance_anxiety', 'fear_of_falling', 'injury_severity',
  'hydration_status', 'time_available', 'temperature', 'humidity'
]

// ================== SCENARIO REVIEW PANEL ==================

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
  const [expandedSection, setExpandedSection] = useState<number>(1)
  const [showSessionStructure, setShowSessionStructure] = useState(false)
  
  // Form state - Section 1: Outcome Predictions
  const [qualityOptimal, setQualityOptimal] = useState(existingResponse?.predicted_quality_optimal || 5)
  const [qualityBaseline, setQualityBaseline] = useState(existingResponse?.predicted_quality_baseline || 5)
  const [predictionConfidence, setPredictionConfidence] = useState<'high' | 'medium' | 'low'>(existingResponse?.prediction_confidence || 'medium')
  
  // Section 2: Session Recommendation
  const [sessionType, setSessionType] = useState<SessionType | ''>(existingResponse?.recommended_session_type || '')
  const [sessionTypeConfidence, setSessionTypeConfidence] = useState<'high' | 'medium' | 'low'>(existingResponse?.session_type_confidence || 'medium')
  
  // Section 3: Treatment Recommendations
  const [treatments, setTreatments] = useState<Record<string, TreatmentRec>>({
    caffeine: { value: 'none', importance: 'neutral' },
    warmup_duration: { value: '15', importance: 'helpful' },
    session_intensity: { value: 'moderate', importance: 'helpful' },
    timing: { value: 'afternoon', importance: 'neutral' },
  })
  
  // Section 4: Counterfactuals
  const [counterfactuals, setCounterfactuals] = useState<Counterfactual[]>([])
  
  // Section 5: Key Drivers
  const [keyDrivers, setKeyDrivers] = useState<KeyDriver[]>([
    { rank: 1, variable: '', direction: 'positive' },
    { rank: 2, variable: '', direction: 'positive' },
    { rank: 3, variable: '', direction: 'positive' },
  ])
  
  // Section 6: Interaction Effects
  const [interactionEffects, setInteractionEffects] = useState<InteractionEffect[]>([])
  
  // Section 7: Session Structure
  const [sessionStructure, setSessionStructure] = useState<SessionStructure>({
    warmup: { durationMin: 15, includeMobility: true, includeTraversing: true, intensity: 'light' },
    mainSession: { focus: 'volume', durationMin: 60, restBetweenAttempts: 'medium', stopCondition: 'time_limit' },
    hangboard: { include: false, contraindicated: false },
    cooldownDurationMin: 10,
    antagonistWork: false,
    activities: [],
  })
  
  // Section 8: Reasoning
  const [reasoning, setReasoning] = useState(existingResponse?.reasoning || '')
  
  // Calculate progress
  const sectionCompletion = {
    1: qualityOptimal !== 5 || qualityBaseline !== 5,
    2: sessionType !== '',
    3: Object.values(treatments).some(t => t.importance !== 'neutral'),
    4: counterfactuals.length > 0,
    5: keyDrivers.filter(kd => kd.variable !== '').length >= 1,
    6: true, // Optional
    7: true, // Optional
    8: reasoning.trim().length > 10,
  }
  const completedSections = Object.values(sectionCompletion).filter(Boolean).length
  const requiredComplete = sectionCompletion[1] && sectionCompletion[2] && sectionCompletion[5] && sectionCompletion[8]

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
      treatment_recommendations: treatments,
      counterfactuals: counterfactuals.map(cf => ({
        variable: cf.variable,
        current_value: cf.actualValue,
        hypothetical_value: cf.counterfactualValue,
        expected_outcome_change: `${cf.newPredictedQuality - qualityOptimal > 0 ? '+' : ''}${(cf.newPredictedQuality - qualityOptimal).toFixed(1)}`,
        confidence: 'medium' as const,
      })),
      key_drivers: keyDrivers.filter(kd => kd.variable).map(kd => ({
        factor: kd.variable,
        direction: kd.direction,
        magnitude: 'medium' as const,
        reasoning: '',
      })),
      interaction_effects: interactionEffects.map(ie => ({
        factors: ie.variables,
        effect_description: ie.description,
        combined_impact: ie.recommendationWith,
      })),
      session_structure: showSessionStructure ? {
        warm_up_duration: sessionStructure.warmup.durationMin,
        main_session_duration: sessionStructure.mainSession.durationMin,
        cool_down_duration: sessionStructure.cooldownDurationMin,
        intensity_distribution: { moderate: 50, high: 30, low: 20 },
        specific_recommendations: [],
      } : undefined,
      reasoning,
      response_duration_sec: durationSec || undefined,
      is_complete: isComplete,
    }

    const { error } = await upsertExpertResponse(input)
    
    if (error) {
      alert('Failed to save response. Please try again.')
    } else {
      if (scenario.status === 'pending') {
        await updateScenario(scenario.id, { status: 'in_review' })
      }
      onResponseSaved()
    }
    
    setSaving(false)
  }

  const baseline = (scenario.baseline_snapshot || {}) as Record<string, unknown>
  const preSession = (scenario.pre_session_snapshot || {}) as Record<string, unknown>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="w-[95%] h-[95%] max-w-[1800px] bg-[#0a0f0d] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-20 px-10 border-b border-white/10 flex items-center justify-between bg-[#0f1312] shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white text-2xl transition-all">←</button>
            <div>
              <h2 className="font-bold text-2xl">Scenario Review</h2>
              <p className="text-sm text-slate-500 mt-0.5">Expert feedback for Bayesian priors</p>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
              scenario.difficulty_level === 'extreme' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
              scenario.difficulty_level === 'edge_case' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {scenario.difficulty_level || 'common'}
            </span>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <div
                key={num}
                className={`w-10 h-10 rounded-xl text-base flex items-center justify-center font-bold transition-all cursor-pointer hover:scale-105 ${
                  sectionCompletion[num as keyof typeof sectionCompletion]
                    ? 'bg-emerald-500/30 text-emerald-300 border-2 border-emerald-500/50'
                    : expandedSection === num
                    ? 'bg-violet-500/30 text-violet-300 border-2 border-violet-500/50'
                    : 'bg-white/5 text-slate-500 border border-white/10'
                }`}
                onClick={() => setExpandedSection(num)}
              >
                {num}
              </div>
            ))}
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">{completedSections}/8</span>
            <p className="text-sm text-slate-500">complete</p>
          </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL - Scenario Info */}
        <div className="w-[42%] min-w-[450px] max-w-[650px] border-r border-white/10 overflow-y-auto bg-[#0c1210]">
          {/* Climber Profile Panel */}
          <div className="p-5 border-b border-white/10">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-300">
              <span className="text-base">👤</span> Climber Profile
            </h3>
            <div className="space-y-2">
              <ProfileItem label="Age" value={String(baseline.age || 'N/A')} />
              <ProfileItem label="Years Climbing" value={String(baseline.years_climbing || baseline.climbing_experience_years || 'N/A')} />
              <ProfileItem label="Boulder Grade" value={String(baseline.highest_boulder_grade || 'N/A')} />
              <ProfileItem label="Sport Grade" value={String(baseline.highest_sport_grade || 'N/A')} />
              <ProfileItem label="Sessions/Week" value={String(baseline.sessions_per_week || 'N/A')} />
              <ProfileItem label="Training Focus" value={String(baseline.training_focus || 'General')} />
              {Array.isArray(baseline.injury_history) && (baseline.injury_history as string[]).length > 0 && (
                <ProfileItem label="Injury History" value={(baseline.injury_history as string[]).join(', ')} />
              )}
            </div>
            
            {/* Psychological Profile */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">Psychological</h4>
              <div className="space-y-3">
                <ProfileSlider label="Fear of Falling" value={Number(baseline.fear_of_falling) || 5} max={10} color="amber" />
                <ProfileSlider label="Performance Anxiety" value={Number(baseline.performance_anxiety_baseline || baseline.performance_anxiety) || 5} max={10} color="red" />
              </div>
            </div>
          </div>

          {/* Pre-Session State Panel */}
          <div className="p-5 border-b border-white/10">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-300">
              <span className="text-base">📊</span> Pre-Session State
            </h3>
            <div className="space-y-3">
              <ProfileSlider label="Energy Level" value={Number(preSession.energy_level) || 5} max={10} color="emerald" />
              <ProfileSlider label="Motivation" value={Number(preSession.motivation) || 5} max={10} color="cyan" />
              <ProfileSlider label="Sleep Quality" value={Number(preSession.sleep_quality) || 5} max={10} color="violet" />
              {typeof preSession.sleep_hours === 'number' && <ProfileItem label="Sleep Hours" value={String(preSession.sleep_hours)} />}
              <ProfileSlider label="Stress Level" value={Number(preSession.stress_level) || 5} max={10} color="amber" inverted />
              <ProfileSlider label="Muscle Soreness" value={Number(preSession.muscle_soreness) || 5} max={10} color="red" inverted />
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <ProfileItem label="Days Since Last Session" value={String(preSession.days_since_last_session ?? 'N/A')} />
              <ProfileItem label="Days Since Rest" value={String(preSession.days_since_rest_day ?? 'N/A')} />
              <ProfileItem label="Planned Duration" value={preSession.planned_duration ? `${preSession.planned_duration} min` : 'N/A'} />
              <ProfileItem label="Primary Goal" value={String(preSession.primary_goal || 'N/A').replace(/_/g, ' ')} />
              <div className="flex gap-2 flex-wrap mt-3">
                {Boolean(preSession.is_outdoor) && <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium">Outdoor</span>}
                {Boolean(preSession.caffeine_today) && <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium">Caffeine</span>}
                {Boolean(preSession.alcohol_last_24h) && <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium">Alcohol 24h</span>}
                {Boolean(preSession.has_pain) && <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium">Pain</span>}
              </div>
            </div>
          </div>

          {/* AI Suggestion Panel */}
          {scenario.ai_recommendation && (
            <div className="p-5">
              <button
                onClick={() => setShowAiSuggestion(!showAiSuggestion)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/15 transition-colors"
              >
                <h3 className="font-medium flex items-center gap-2 text-sm">
                  <span>🤖</span> AI Suggestion
                </h3>
                <span className="text-xs text-cyan-400">{showAiSuggestion ? '▲' : '▼'}</span>
              </button>
              
              {showAiSuggestion && (
                <div className="mt-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-3">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-medium">Recommended</span>
                    <p className="text-base font-semibold text-cyan-300 mt-1">
                      {String((scenario.ai_recommendation as Record<string, unknown>)?.session_type || 'N/A')}
                    </p>
                  </div>
                  {scenario.ai_reasoning && (
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-medium">Reasoning</span>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{String(scenario.ai_reasoning)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL - Expert Input Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8 space-y-5">
            {/* Section 1: Outcome Predictions */}
            <FormSection
              number={1}
              title="Outcome Predictions"
              icon="📈"
              isExpanded={expandedSection === 1}
              isComplete={sectionCompletion[1]}
              onToggle={() => setExpandedSection(expandedSection === 1 ? 0 : 1)}
            >
              <OutcomePredictionsForm
                qualityOptimal={qualityOptimal}
                setQualityOptimal={setQualityOptimal}
                qualityBaseline={qualityBaseline}
                setQualityBaseline={setQualityBaseline}
                confidence={predictionConfidence}
                setConfidence={setPredictionConfidence}
              />
            </FormSection>

            {/* Section 2: Session Recommendation */}
            <FormSection
              number={2}
              title="Session Recommendation"
              icon="🎯"
              isExpanded={expandedSection === 2}
              isComplete={sectionCompletion[2]}
              onToggle={() => setExpandedSection(expandedSection === 2 ? 0 : 2)}
            >
              <SessionRecommendationForm
                sessionType={sessionType}
                setSessionType={setSessionType}
                confidence={sessionTypeConfidence}
                setConfidence={setSessionTypeConfidence}
              />
            </FormSection>

            {/* Section 3: Treatment Recommendations */}
            <FormSection
              number={3}
              title="Treatment Recommendations"
              icon="💊"
              isExpanded={expandedSection === 3}
              isComplete={sectionCompletion[3]}
              onToggle={() => setExpandedSection(expandedSection === 3 ? 0 : 3)}
            >
              <TreatmentForm treatments={treatments} setTreatments={setTreatments} />
            </FormSection>

            {/* Section 4: Counterfactuals */}
            <FormSection
              number={4}
              title="Counterfactuals"
              icon="🔄"
              isExpanded={expandedSection === 4}
              isComplete={sectionCompletion[4]}
              onToggle={() => setExpandedSection(expandedSection === 4 ? 0 : 4)}
            >
              <CounterfactualInput
                counterfactuals={counterfactuals}
                setCounterfactuals={setCounterfactuals}
                preSession={preSession}
              />
            </FormSection>

            {/* Section 5: Key Drivers */}
            <FormSection
              number={5}
              title="Key Drivers (Top 3)"
              icon="🔑"
              isExpanded={expandedSection === 5}
              isComplete={sectionCompletion[5]}
              onToggle={() => setExpandedSection(expandedSection === 5 ? 0 : 5)}
            >
              <KeyDriversInput keyDrivers={keyDrivers} setKeyDrivers={setKeyDrivers} />
            </FormSection>

            {/* Section 6: Interaction Effects (Optional) */}
            <FormSection
              number={6}
              title="Interaction Effects"
              icon="🔗"
              isExpanded={expandedSection === 6}
              isComplete={sectionCompletion[6]}
              onToggle={() => setExpandedSection(expandedSection === 6 ? 0 : 6)}
              optional
            >
              <InteractionEffectsInput
                effects={interactionEffects}
                setEffects={setInteractionEffects}
              />
            </FormSection>

            {/* Section 7: Session Structure (Optional) */}
            <FormSection
              number={7}
              title="Session Structure"
              icon="📋"
              isExpanded={expandedSection === 7}
              isComplete={sectionCompletion[7]}
              onToggle={() => setExpandedSection(expandedSection === 7 ? 0 : 7)}
              optional
            >
              <SessionStructureForm
                enabled={showSessionStructure}
                setEnabled={setShowSessionStructure}
                structure={sessionStructure}
                setStructure={setSessionStructure}
              />
            </FormSection>

            {/* Section 8: Reasoning */}
            <FormSection
              number={8}
              title="Reasoning"
              icon="💭"
              isExpanded={expandedSection === 8}
              isComplete={sectionCompletion[8]}
              onToggle={() => setExpandedSection(expandedSection === 8 ? 0 : 8)}
            >
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[150px]"
                placeholder="Explain your reasoning for this recommendation. What factors were most important? Why did you choose this session type? What would change your recommendation?"
              />
            </FormSection>

          </div>
        </div>
      </div>

        {/* Footer Actions - Inside the modal */}
        <div className="shrink-0 p-6 border-t border-white/10 bg-[#0f1312] flex gap-5 justify-center">
          <button
            onClick={onClose}
            className="px-10 py-4 rounded-xl border border-white/20 text-slate-300 font-semibold text-lg hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-10 py-4 rounded-xl border-2 border-violet-500/40 text-violet-300 font-semibold text-lg hover:bg-violet-500/10 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !requiredComplete}
            className="px-12 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ================== HELPER COMPONENTS ==================

function ProfileItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-100 font-medium text-sm capitalize">{value}</span>
    </div>
  )
}

function ProfileSlider({ label, value, max, color, inverted }: { label: string; value: number; max: number; color: string; inverted?: boolean }) {
  const pct = (value / max) * 100
  const colorClass = inverted
    ? (value > 6 ? 'bg-red-500' : value > 3 ? 'bg-amber-500' : 'bg-emerald-500')
    : (value > 6 ? 'bg-emerald-500' : value > 3 ? 'bg-amber-500' : 'bg-red-500')
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={`text-${color}-400 font-semibold`}>{value}/{max}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FormSection({ 
  number, title, icon, isExpanded, isComplete, onToggle, optional, children 
}: { 
  number: number; title: string; icon: string; isExpanded: boolean; isComplete: boolean; onToggle: () => void; optional?: boolean; children: React.ReactNode 
}) {
  return (
    <div className={`rounded-2xl border-2 transition-all ${
      isComplete ? 'border-emerald-500/40 bg-emerald-500/5' : 
      isExpanded ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/10 bg-white/[0.02]'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-5">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
            isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10'
          }`}>
            {isComplete ? '✓' : icon}
          </div>
          <div className="text-left">
            <span className="font-bold text-xl">{number}. {title}</span>
            {optional && <span className="text-base text-slate-500 ml-3">(Optional)</span>}
          </div>
        </div>
        <span className="text-slate-400 text-xl">{isExpanded ? '▲' : '▼'}</span>
      </button>
      
      {isExpanded && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  )
}

function OutcomePredictionsForm({
  qualityOptimal, setQualityOptimal,
  qualityBaseline, setQualityBaseline,
  confidence, setConfidence,
}: {
  qualityOptimal: number; setQualityOptimal: (v: number) => void
  qualityBaseline: number; setQualityBaseline: (v: number) => void
  confidence: 'high' | 'medium' | 'low'; setConfidence: (v: 'high' | 'medium' | 'low') => void
}) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-slate-300">If they follow your recommendations</label>
          <span className="text-2xl font-bold text-emerald-400">{qualityOptimal}/10</span>
        </div>
        <input
          type="range" min="1" max="10" step="0.5"
          value={qualityOptimal}
          onChange={(e) => setQualityOptimal(parseFloat(e.target.value))}
          className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <p className="text-xs text-slate-500 mt-2">Expected session quality with optimal intervention</p>
      </div>
      
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-slate-300">If they proceed with original plan</label>
          <span className="text-2xl font-bold text-amber-400">{qualityBaseline}/10</span>
        </div>
        <input
          type="range" min="1" max="10" step="0.5"
          value={qualityBaseline}
          onChange={(e) => setQualityBaseline(parseFloat(e.target.value))}
          className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <p className="text-xs text-slate-500 mt-2">Expected session quality without intervention</p>
      </div>

      <div>
        <label className="text-sm text-slate-300 block mb-2">Prediction Confidence</label>
        <div className="flex gap-2">
          {(['high', 'medium', 'low'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setConfidence(level)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                confidence === level
                  ? 'bg-violet-500/20 text-violet-300 border-2 border-violet-500/50'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionRecommendationForm({
  sessionType, setSessionType,
  confidence, setConfidence,
}: {
  sessionType: SessionType | ''; setSessionType: (v: SessionType) => void
  confidence: 'high' | 'medium' | 'low'; setConfidence: (v: 'high' | 'medium' | 'low') => void
}) {
  const sessionTypes: { value: SessionType; label: string; icon: string; desc: string }[] = [
    { value: 'project', label: 'Project Session', icon: '🎯', desc: 'Work on specific project' },
    { value: 'limit_bouldering', label: 'Limit Bouldering', icon: '💪', desc: 'Max effort attempts' },
    { value: 'volume', label: 'Volume', icon: '📊', desc: 'High rep count, moderate intensity' },
    { value: 'technique', label: 'Technique', icon: '🎨', desc: 'Focus on movement quality' },
    { value: 'training', label: 'Training', icon: '🏋️', desc: 'Structured training exercises' },
    { value: 'light_session', label: 'Light Session', icon: '🌤️', desc: 'Easy climbing, low intensity' },
    { value: 'rest_day', label: 'Rest Day', icon: '😴', desc: 'Complete rest recommended' },
    { value: 'active_recovery', label: 'Active Recovery', icon: '🧘', desc: 'Light movement, mobility' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {sessionTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSessionType(type.value)}
            className={`p-4 rounded-xl text-left transition-all ${
              sessionType === type.value
                ? 'bg-violet-500/20 border-2 border-violet-500/50'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{type.icon}</span>
              <span className="font-medium text-sm">{type.label}</span>
            </div>
            <p className="text-xs text-slate-400">{type.desc}</p>
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm text-slate-300 block mb-2">Confidence in this recommendation</label>
        <div className="flex gap-2">
          {(['high', 'medium', 'low'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setConfidence(level)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                confidence === level
                  ? 'bg-violet-500/20 text-violet-300 border-2 border-violet-500/50'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TreatmentForm({ treatments, setTreatments }: {
  treatments: Record<string, TreatmentRec>
  setTreatments: (t: Record<string, TreatmentRec>) => void
}) {
  const updateTreatment = (key: string, field: 'value' | 'importance', val: string) => {
    setTreatments({ ...treatments, [key]: { ...treatments[key], [field]: val } })
  }

  return (
    <div className="space-y-4">
      {/* Caffeine */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">☕ Caffeine</span>
          <ImportanceSelector value={treatments.caffeine.importance} onChange={(v) => updateTreatment('caffeine', 'importance', v)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['none', '50-100mg', '100-200mg', '200-300mg', '300+mg'].map((opt) => (
            <button
              key={opt}
              onClick={() => updateTreatment('caffeine', 'value', opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                treatments.caffeine.value === opt
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {opt === 'none' ? 'None' : opt}
            </button>
          ))}
        </div>
      </div>

      {/* Warmup Duration */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">🔥 Warmup Duration</span>
          <ImportanceSelector value={treatments.warmup_duration.importance} onChange={(v) => updateTreatment('warmup_duration', 'importance', v)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['10', '15', '20', '25', '30+'].map((opt) => (
            <button
              key={opt}
              onClick={() => updateTreatment('warmup_duration', 'value', opt)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                treatments.warmup_duration.value === opt
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {opt} min
            </button>
          ))}
        </div>
      </div>

      {/* Session Intensity */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">⚡ Session Intensity</span>
          <ImportanceSelector value={treatments.session_intensity.importance} onChange={(v) => updateTreatment('session_intensity', 'importance', v)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['very_light', 'light', 'moderate', 'high', 'max_effort'].map((opt) => (
            <button
              key={opt}
              onClick={() => updateTreatment('session_intensity', 'value', opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                treatments.session_intensity.value === opt
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Timing */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">🕐 Session Timing</span>
          <ImportanceSelector value={treatments.timing.importance} onChange={(v) => updateTreatment('timing', 'importance', v)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['morning', 'midday', 'afternoon', 'evening', 'any'].map((opt) => (
            <button
              key={opt}
              onClick={() => updateTreatment('timing', 'value', opt)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                treatments.timing.value === opt
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ImportanceSelector({ value, onChange }: { value: string; onChange: (v: 'critical' | 'helpful' | 'neutral' | 'avoid') => void }) {
  const options: { v: 'critical' | 'helpful' | 'neutral' | 'avoid'; label: string; color: string }[] = [
    { v: 'critical', label: 'Critical', color: 'red' },
    { v: 'helpful', label: 'Helpful', color: 'emerald' },
    { v: 'neutral', label: 'Neutral', color: 'slate' },
    { v: 'avoid', label: 'Avoid', color: 'amber' },
  ]

  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.v}
          onClick={() => onChange(opt.v)}
          className={`px-2 py-1 rounded text-xs transition-all ${
            value === opt.v
              ? opt.color === 'red' ? 'bg-red-500/20 text-red-300'
                : opt.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300'
                : opt.color === 'amber' ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-500/20 text-slate-300'
              : 'bg-white/5 text-slate-500 hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CounterfactualInput({ counterfactuals, setCounterfactuals, preSession }: {
  counterfactuals: Counterfactual[]
  setCounterfactuals: (cf: Counterfactual[]) => void
  preSession: Record<string, unknown>
}) {
  const addCounterfactual = () => {
    setCounterfactuals([...counterfactuals, {
      variable: '',
      actualValue: 0,
      counterfactualValue: 0,
      newPredictedQuality: 5,
      wouldChangeSessionType: false,
    }])
  }

  const updateCounterfactual = (idx: number, field: string, value: unknown) => {
    const updated = [...counterfactuals]
    updated[idx] = { ...updated[idx], [field]: value }
    
    // Auto-fill actual value when variable changes
    if (field === 'variable' && typeof value === 'string') {
      const actualVal = preSession[value]
      if (typeof actualVal === 'number') {
        updated[idx].actualValue = actualVal
      }
    }
    
    setCounterfactuals(updated)
  }

  const removeCounterfactual = (idx: number) => {
    setCounterfactuals(counterfactuals.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Add counterfactual judgments: "If X were different, what would happen?"
      </p>
      
      {counterfactuals.map((cf, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-white/5 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-500">Counterfactual #{idx + 1}</span>
            <button onClick={() => removeCounterfactual(idx)} className="text-red-400 hover:text-red-300 text-sm">×</button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Variable</label>
              <select
                value={cf.variable}
                onChange={(e) => updateCounterfactual(idx, 'variable', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="">Select...</option>
                {AVAILABLE_VARIABLES.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Actual Value</label>
              <input
                type="number"
                value={cf.actualValue}
                onChange={(e) => updateCounterfactual(idx, 'actualValue', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Counterfactual Value</label>
              <input
                type="number"
                value={cf.counterfactualValue}
                onChange={(e) => updateCounterfactual(idx, 'counterfactualValue', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-slate-500 mb-1 block">New Expected Quality: {cf.newPredictedQuality}/10</label>
            <input
              type="range" min="1" max="10" step="0.5"
              value={cf.newPredictedQuality}
              onChange={(e) => updateCounterfactual(idx, 'newPredictedQuality', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cf.wouldChangeSessionType}
              onChange={(e) => updateCounterfactual(idx, 'wouldChangeSessionType', e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-violet-500"
            />
            <span className="text-sm">Would change session type recommendation</span>
          </label>
        </div>
      ))}
      
      <button
        onClick={addCounterfactual}
        className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:border-violet-500/50 hover:text-violet-300 transition-all"
      >
        + Add Counterfactual
      </button>
    </div>
  )
}

function KeyDriversInput({ keyDrivers, setKeyDrivers }: {
  keyDrivers: KeyDriver[]
  setKeyDrivers: (kd: KeyDriver[]) => void
}) {
  const updateDriver = (rank: number, field: 'variable' | 'direction', value: string) => {
    const updated = keyDrivers.map(kd => 
      kd.rank === rank ? { ...kd, [field]: value } : kd
    )
    setKeyDrivers(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Rank the top 3 factors driving your recommendation.
      </p>
      
      {keyDrivers.map((driver) => (
        <div key={driver.rank} className="p-4 rounded-xl bg-white/5 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center font-bold text-violet-300">
            {driver.rank}
          </div>
          
          <div className="flex-1">
            <select
              value={driver.variable}
              onChange={(e) => updateDriver(driver.rank, 'variable', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Select variable...</option>
              {AVAILABLE_VARIABLES.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => updateDriver(driver.rank, 'direction', 'positive')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                driver.direction === 'positive'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              ↑ Positive
            </button>
            <button
              onClick={() => updateDriver(driver.rank, 'direction', 'negative')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                driver.direction === 'negative'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              ↓ Negative
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function InteractionEffectsInput({ effects, setEffects }: {
  effects: InteractionEffect[]
  setEffects: (e: InteractionEffect[]) => void
}) {
  const addEffect = () => {
    setEffects([...effects, {
      variables: ['', ''],
      description: '',
      recommendationWithout: '',
      recommendationWith: '',
    }])
  }

  const removeEffect = (idx: number) => {
    setEffects(effects.filter((_, i) => i !== idx))
  }

  const updateEffect = (idx: number, field: string, value: unknown) => {
    const updated = [...effects]
    updated[idx] = { ...updated[idx], [field]: value }
    setEffects(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Describe any interaction effects between variables that influence your recommendation.
      </p>
      
      {effects.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No interaction effects added yet.</p>
      ) : effects.map((effect, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-white/5 space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Interaction #{idx + 1}</span>
            <button onClick={() => removeEffect(idx)} className="text-red-400 hover:text-red-300 text-sm">×</button>
          </div>
          
          <div className="flex gap-2 items-center">
            <select
              value={effect.variables[0]}
              onChange={(e) => updateEffect(idx, 'variables', [e.target.value, effect.variables[1]])}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Variable 1</option>
              {AVAILABLE_VARIABLES.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="text-slate-500">×</span>
            <select
              value={effect.variables[1]}
              onChange={(e) => updateEffect(idx, 'variables', [effect.variables[0], e.target.value])}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Variable 2</option>
              {AVAILABLE_VARIABLES.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          
          <textarea
            value={effect.description}
            onChange={(e) => updateEffect(idx, 'description', e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Describe how these variables interact..."
            rows={2}
          />
        </div>
      ))}
      
      <button
        onClick={addEffect}
        className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:border-violet-500/50 hover:text-violet-300 transition-all"
      >
        + Add Interaction Effect
      </button>
    </div>
  )
}

const ACTIVITY_TYPES = [
  { value: 'warmup', label: '🔥 Warmup', color: 'amber' },
  { value: 'projecting', label: '🎯 Projecting', color: 'violet' },
  { value: 'limit_bouldering', label: '💪 Limit Bouldering', color: 'red' },
  { value: 'volume', label: '📊 Volume Climbing', color: 'blue' },
  { value: 'technique', label: '🎨 Technique Drills', color: 'cyan' },
  { value: 'hangboard', label: '🤏 Hangboard', color: 'orange' },
  { value: 'campus', label: '⬆️ Campus Board', color: 'pink' },
  { value: 'stretching', label: '🧘 Stretching', color: 'emerald' },
  { value: 'cooldown', label: '❄️ Cooldown', color: 'sky' },
  { value: 'antagonist', label: '🔄 Antagonist Work', color: 'lime' },
  { value: 'cardio', label: '🏃 Cardio', color: 'rose' },
  { value: 'core', label: '🎯 Core Training', color: 'fuchsia' },
  { value: 'custom', label: '✏️ Custom', color: 'slate' },
] as const

function SessionStructureForm({ enabled, setEnabled, structure, setStructure }: {
  enabled: boolean
  setEnabled: (e: boolean) => void
  structure: SessionStructure
  setStructure: (s: SessionStructure) => void
}) {
  const addActivity = (type: SessionActivity['type']) => {
    const newActivity: SessionActivity = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      durationMin: type === 'warmup' ? 15 : type === 'cooldown' ? 10 : type === 'stretching' ? 10 : 30,
      intensity: type === 'warmup' ? 'light' : type === 'cooldown' || type === 'stretching' ? 'very_light' : 'moderate',
    }
    setStructure({ ...structure, activities: [...structure.activities, newActivity] })
  }

  const updateActivity = (id: string, updates: Partial<SessionActivity>) => {
    setStructure({
      ...structure,
      activities: structure.activities.map(a => a.id === id ? { ...a, ...updates } : a)
    })
  }

  const removeActivity = (id: string) => {
    setStructure({
      ...structure,
      activities: structure.activities.filter(a => a.id !== id)
    })
  }

  const moveActivity = (id: string, direction: 'up' | 'down') => {
    const index = structure.activities.findIndex(a => a.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === structure.activities.length - 1) return
    
    const newActivities = [...structure.activities]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newActivities[index], newActivities[swapIndex]] = [newActivities[swapIndex], newActivities[index]]
    setStructure({ ...structure, activities: newActivities })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-white/20 bg-white/5 text-violet-500"
        />
        <span className="text-sm">Include detailed session structure recommendation</span>
      </label>
      
      {enabled && (
        <div className="space-y-4">
          {/* Activity List */}
          {structure.activities.length > 0 && (
            <div className="space-y-2">
              {structure.activities.map((activity, index) => (
                <div key={activity.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveActivity(activity.id, 'up')}
                        disabled={index === 0}
                        className="text-xs text-slate-500 hover:text-white disabled:opacity-30"
                      >▲</button>
                      <button
                        onClick={() => moveActivity(activity.id, 'down')}
                        disabled={index === structure.activities.length - 1}
                        className="text-xs text-slate-500 hover:text-white disabled:opacity-30"
                      >▼</button>
                    </div>
                    
                    <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
                    
                    <select
                      value={activity.type}
                      onChange={(e) => updateActivity(activity.id, { type: e.target.value as SessionActivity['type'] })}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                    >
                      {ACTIVITY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activity.durationMin}
                        onChange={(e) => updateActivity(activity.id, { durationMin: parseInt(e.target.value) || 10 })}
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-center"
                      />
                      <span className="text-xs text-slate-500">min</span>
                    </div>
                    
                    <select
                      value={activity.intensity || 'moderate'}
                      onChange={(e) => updateActivity(activity.id, { intensity: e.target.value as SessionActivity['intensity'] })}
                      className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="very_light">Very Light</option>
                      <option value="light">Light</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="max">Max</option>
                    </select>
                    
                    <button
                      onClick={() => removeActivity(activity.id)}
                      className="text-red-400 hover:text-red-300 text-lg px-2"
                    >×</button>
                  </div>
                  
                  {activity.type === 'custom' && (
                    <input
                      type="text"
                      value={activity.notes || ''}
                      onChange={(e) => updateActivity(activity.id, { notes: e.target.value })}
                      placeholder="Describe the activity..."
                      className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Activity Buttons */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Add activities to the session:</p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map(actType => (
                <button
                  key={actType.value}
                  onClick={() => addActivity(actType.value as SessionActivity['type'])}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
                >
                  {actType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Templates */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs text-slate-500 mb-2">Quick templates:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStructure({
                  ...structure,
                  activities: [
                    { id: '1', type: 'warmup', durationMin: 15, intensity: 'light' },
                    { id: '2', type: 'projecting', durationMin: 60, intensity: 'high' },
                    { id: '3', type: 'cooldown', durationMin: 10, intensity: 'very_light' },
                  ]
                })}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-500/30 transition-colors"
              >
                🎯 Project Session
              </button>
              <button
                onClick={() => setStructure({
                  ...structure,
                  activities: [
                    { id: '1', type: 'warmup', durationMin: 15, intensity: 'light' },
                    { id: '2', type: 'volume', durationMin: 90, intensity: 'moderate' },
                    { id: '3', type: 'stretching', durationMin: 15, intensity: 'very_light' },
                  ]
                })}
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs hover:bg-blue-500/30 transition-colors"
              >
                📊 Volume Session
              </button>
              <button
                onClick={() => setStructure({
                  ...structure,
                  activities: [
                    { id: '1', type: 'warmup', durationMin: 20, intensity: 'moderate' },
                    { id: '2', type: 'hangboard', durationMin: 30, intensity: 'high' },
                    { id: '3', type: 'limit_bouldering', durationMin: 45, intensity: 'max' },
                    { id: '4', type: 'antagonist', durationMin: 15, intensity: 'moderate' },
                    { id: '5', type: 'stretching', durationMin: 10, intensity: 'very_light' },
                  ]
                })}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/30 transition-colors"
              >
                💪 Training Session
              </button>
              <button
                onClick={() => setStructure({
                  ...structure,
                  activities: [
                    { id: '1', type: 'warmup', durationMin: 10, intensity: 'very_light' },
                    { id: '2', type: 'stretching', durationMin: 20, intensity: 'very_light' },
                    { id: '3', type: 'technique', durationMin: 30, intensity: 'light' },
                  ]
                })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/30 transition-colors"
              >
                🌿 Recovery Session
              </button>
              <button
                onClick={() => setStructure({ ...structure, activities: [] })}
                className="px-3 py-1.5 rounded-lg bg-slate-500/20 border border-slate-500/30 text-slate-300 text-xs hover:bg-slate-500/30 transition-colors"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>

          {/* Session Summary */}
          {structure.activities.length > 0 && (
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-sm text-violet-300">
                <strong>Total Duration:</strong> {structure.activities.reduce((sum, a) => sum + a.durationMin, 0)} minutes
                <span className="mx-2">•</span>
                <strong>{structure.activities.length}</strong> activities
              </p>
            </div>
          )}
        </div>
      )}
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

function CreateScenarioModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'baseline' | 'presession' | 'meta'>('baseline')
  
  // Scenario metadata
  const [description, setDescription] = useState('')
  const [difficultyLevel, setDifficultyLevel] = useState<'common' | 'edge_case' | 'extreme'>('common')
  const [edgeCaseTags, setEdgeCaseTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  
  // Baseline snapshot (climber profile)
  const [baselineSnapshot, setBaselineSnapshot] = useState({
    climbing_experience_years: 3,
    highest_boulder_grade: 'V5',
    highest_sport_grade: '5.11c',
    sessions_per_week: 3,
    injury_history: [] as string[],
    fear_of_falling: 5,
    training_focus: 'general',
  })
  
  // Pre-session snapshot (current state)
  const [preSessionSnapshot, setPreSessionSnapshot] = useState({
    energy_level: 7,
    motivation: 7,
    sleep_quality: 7,
    stress_level: 4,
    days_since_last_session: 2,
    days_since_rest_day: 1,
    muscle_soreness: 3,
    has_pain: false,
    pain_location: '',
    pain_severity: 0,
    caffeine_today: false,
    alcohol_last_24h: false,
    primary_goal: 'volume',
    planned_duration: 90,
    is_outdoor: false,
  })

  const handleAddTag = () => {
    if (tagInput.trim() && !edgeCaseTags.includes(tagInput.trim())) {
      setEdgeCaseTags([...edgeCaseTags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setEdgeCaseTags(edgeCaseTags.filter(t => t !== tag))
  }

  const handleSave = async () => {
    setSaving(true)
    
    const input: CreateScenarioInput = {
      baseline_snapshot: baselineSnapshot,
      pre_session_snapshot: preSessionSnapshot,
      scenario_description: description,
      edge_case_tags: edgeCaseTags.length > 0 ? edgeCaseTags : undefined,
      difficulty_level: difficultyLevel,
    }

    const { error } = await createScenario(input)
    
    if (error) {
      alert('Failed to create scenario. Please try again.')
    } else {
      onCreated()
    }
    
    setSaving(false)
  }

  const suggestedTags = [
    'injury_present', 'high_fatigue', 'low_motivation', 'outdoor_conditions',
    'competition_prep', 'returning_from_break', 'overtraining', 'mental_block',
    'weather_dependent', 'time_constrained', 'recovery_focused', 'project_session'
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 bg-[#0f1312] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Create New Scenario</h2>
            <p className="text-sm text-slate-400">Define a synthetic climbing scenario for expert review</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 pt-4 flex gap-2">
          {[
            { id: 'baseline' as const, label: 'Climber Profile', icon: '👤' },
            { id: 'presession' as const, label: 'Current State', icon: '📊' },
            { id: 'meta' as const, label: 'Scenario Details', icon: '🏷️' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSection === 'baseline' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Climbing Experience</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Years Climbing</label>
                    <input
                      type="number"
                      min="0"
                      value={baselineSnapshot.climbing_experience_years}
                      onChange={(e) => setBaselineSnapshot({ ...baselineSnapshot, climbing_experience_years: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Sessions per Week</label>
                    <input
                      type="number"
                      min="0"
                      max="14"
                      value={baselineSnapshot.sessions_per_week}
                      onChange={(e) => setBaselineSnapshot({ ...baselineSnapshot, sessions_per_week: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Highest Boulder Grade</label>
                    <select
                      value={baselineSnapshot.highest_boulder_grade}
                      onChange={(e) => setBaselineSnapshot({ ...baselineSnapshot, highest_boulder_grade: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    >
                      {['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Highest Sport Grade</label>
                    <select
                      value={baselineSnapshot.highest_sport_grade}
                      onChange={(e) => setBaselineSnapshot({ ...baselineSnapshot, highest_sport_grade: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    >
                      {['5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a+'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Psychological Profile</h3>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <label className="text-slate-400">Fear of Falling</label>
                    <span className="text-violet-400">{baselineSnapshot.fear_of_falling}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={baselineSnapshot.fear_of_falling}
                    onChange={(e) => setBaselineSnapshot({ ...baselineSnapshot, fear_of_falling: parseInt(e.target.value) })}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'presession' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Physical State</h3>
                <div className="space-y-4">
                  {[
                    { key: 'energy_level', label: 'Energy Level', color: 'emerald' },
                    { key: 'motivation', label: 'Motivation', color: 'cyan' },
                    { key: 'sleep_quality', label: 'Sleep Quality', color: 'violet' },
                    { key: 'stress_level', label: 'Stress Level', color: 'amber' },
                    { key: 'muscle_soreness', label: 'Muscle Soreness', color: 'red' },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="text-slate-400">{item.label}</label>
                        <span className={`text-${item.color}-400`}>
                          {preSessionSnapshot[item.key as keyof typeof preSessionSnapshot] as number}/10
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={preSessionSnapshot[item.key as keyof typeof preSessionSnapshot] as number}
                        onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, [item.key]: parseInt(e.target.value) })}
                        className={`w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-${item.color}-500`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Session Context</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Days Since Last Session</label>
                    <input
                      type="number"
                      min="0"
                      value={preSessionSnapshot.days_since_last_session}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, days_since_last_session: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Days Since Rest Day</label>
                    <input
                      type="number"
                      min="0"
                      value={preSessionSnapshot.days_since_rest_day}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, days_since_rest_day: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Planned Duration (min)</label>
                    <input
                      type="number"
                      min="30"
                      max="300"
                      value={preSessionSnapshot.planned_duration}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, planned_duration: parseInt(e.target.value) || 90 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Primary Goal</label>
                    <select
                      value={preSessionSnapshot.primary_goal}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, primary_goal: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                    >
                      <option value="push_limits">Push Limits</option>
                      <option value="volume">Volume / Mileage</option>
                      <option value="technique">Technique Focus</option>
                      <option value="active_recovery">Active Recovery</option>
                      <option value="social">Social / Fun</option>
                      <option value="skill_work">Specific Skill Work</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preSessionSnapshot.is_outdoor}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, is_outdoor: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-violet-500"
                    />
                    <span className="text-sm">Outdoor Session</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preSessionSnapshot.caffeine_today}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, caffeine_today: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-violet-500"
                    />
                    <span className="text-sm">Caffeine Today</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preSessionSnapshot.alcohol_last_24h}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, alcohol_last_24h: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-violet-500"
                    />
                    <span className="text-sm">Alcohol in Last 24h</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preSessionSnapshot.has_pain}
                      onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, has_pain: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-violet-500"
                    />
                    <span className="text-sm">Has Pain/Injury</span>
                  </label>
                </div>

                {preSessionSnapshot.has_pain && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-3">
                    <div>
                      <label className="text-sm text-slate-400 block mb-2">Pain Location</label>
                      <input
                        type="text"
                        value={preSessionSnapshot.pain_location}
                        onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, pain_location: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                        placeholder="e.g., Left finger A2 pulley"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="text-slate-400">Pain Severity</label>
                        <span className="text-red-400">{preSessionSnapshot.pain_severity}/10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={preSessionSnapshot.pain_severity}
                        onChange={(e) => setPreSessionSnapshot({ ...preSessionSnapshot, pain_severity: parseInt(e.target.value) })}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'meta' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Scenario Description</h3>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500"
                  placeholder="Describe the scenario context and what makes it interesting for expert review..."
                  rows={4}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Difficulty Level</h3>
                <div className="flex gap-2">
                  {[
                    { value: 'common' as const, label: 'Common', icon: '🟢', desc: 'Typical scenario' },
                    { value: 'edge_case' as const, label: 'Edge Case', icon: '🟡', desc: 'Unusual combination' },
                    { value: 'extreme' as const, label: 'Extreme', icon: '🔴', desc: 'Challenging decision' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setDifficultyLevel(level.value)}
                      className={`flex-1 p-3 rounded-lg text-left transition-all ${
                        difficultyLevel === level.value
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{level.icon}</span>
                        <span className="font-medium text-sm">{level.label}</span>
                      </div>
                      <p className="text-xs text-slate-400">{level.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-medium mb-4">Edge Case Tags</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm"
                    placeholder="Add custom tag..."
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-500/30"
                  >
                    Add
                  </button>
                </div>
                
                {edgeCaseTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {edgeCaseTags.map((tag) => (
                      <span key={tag} className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs flex items-center gap-2">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-slate-500 mb-2">Suggested tags:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.filter(t => !edgeCaseTags.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setEdgeCaseTags([...edgeCaseTags, tag])}
                      className="px-2 py-1 rounded bg-white/5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Scenario'}
          </button>
        </div>
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

