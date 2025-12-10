import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppBackground } from './components/AppBackground'
import { Layout } from './components/Layout'
import { CoachLayout } from './components/CoachLayout'
import { SessionFlow, CompleteSessionFlow } from './components/SessionFlow'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { CoachDashboard } from './pages/CoachDashboard'
import { AthleteDetail } from './pages/AthleteDetail'
import { Settings } from './pages/Settings'
import { AcceptInvitation } from './pages/AcceptInvitation'
import { SessionReview } from './pages/SessionReview'
import { SessionHistory } from './pages/SessionHistory'
import { SessionDetail } from './pages/SessionDetail'
import { EditSession } from './pages/EditSession'
import { Stats } from './pages/Stats'
import { Goals } from './pages/Goals'
import { NewGoal } from './pages/NewGoal'
import { ExpertDataCapture } from './pages/ExpertDataCapture'
import { AnimatedCardDemo } from './components/AnimatedCardDemo'

const queryClient = new QueryClient()

function NewSession() {
  return (
    <div className="p-8">
      <SessionFlow />
    </div>
  )
}

function CompleteSession() {
  return (
    <div className="p-8">
      <CompleteSessionFlow />
    </div>
  )
}

function Recommendations() {
  const tips = [
    { icon: '💪', title: 'Focus on finger strength', desc: 'Your data suggests hangboard training could boost your max grade.', confidence: 87 },
    { icon: '🎯', title: 'Try more overhangs', desc: 'You climb vertical terrain well but steep problems are a weakness.', confidence: 72 },
    { icon: '😴', title: 'Prioritize recovery', desc: 'Your performance dips after 3 consecutive climbing days.', confidence: 91 },
    { icon: '🧘', title: 'Add mobility work', desc: 'Hip flexibility could help you reach further on technical routes.', confidence: 65 },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">AI Insights</h1>
          <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-medium">Beta</span>
        </div>
        <p className="text-slate-400">Personalized recommendations based on your climbing data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tips.map((tip, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:bg-white/[0.07] transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl">
                {tip.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{tip.title}</h3>
                <p className="text-sm text-slate-400 mb-3">{tip.desc}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500"
                      style={{ width: `${tip.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{tip.confidence}% confidence</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5">
        <div className="flex items-start gap-4">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="font-semibold mb-1">Unlock more insights</h3>
            <p className="text-sm text-slate-400 mb-4">
              Upgrade to Premium for unlimited AI recommendations, advanced analytics, and personalized training plans.
            </p>
            <a
              href="/settings"
              className="inline-flex px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-medium hover:from-fuchsia-500 hover:to-cyan-500 transition-all"
            >
              View Plans
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Smart dashboard that shows the right view based on user role
function SmartDashboard() {
  const { isCoach } = useAuth()
  return isCoach() ? <CoachDashboard /> : <Dashboard />
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, needsOnboarding } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />

  // Redirect to onboarding if not completed
  if (needsOnboarding()) return <Navigate to="/onboarding" />

  return <Layout>{children}</Layout>
}

function CoachRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isCoach } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />
  if (!isCoach()) return <Navigate to="/" />

  return <CoachLayout>{children}</CoachLayout>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppBackground />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/accept-invitation/:invitationId" element={<AcceptInvitation />} />

            {/* Protected routes - Smart routing based on role */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <SmartDashboard />
                </ProtectedRoute>
              }
            />

            {/* Athlete routes */}
            <Route
              path="/session/new"
              element={
                <ProtectedRoute>
                  <NewSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session/complete"
              element={
                <ProtectedRoute>
                  <CompleteSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session/review"
              element={
                <ProtectedRoute>
                  <SessionReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <ProtectedRoute>
                  <SessionHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute>
                  <Stats />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expert-data"
              element={
                <ProtectedRoute>
                  <ExpertDataCapture />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId"
              element={
                <ProtectedRoute>
                  <SessionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId/edit"
              element={
                <ProtectedRoute>
                  <EditSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={<Navigate to="/sessions" replace />}
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <Recommendations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <Goals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals/new"
              element={
                <ProtectedRoute>
                  <NewGoal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/demo"
              element={
                <div className="min-h-screen p-8 bg-background text-foreground flex items-center justify-center">
                  <AnimatedCardDemo />
                </div>
              }
            />

            {/* Coach-only routes */}
            <Route
              path="/athlete/:athleteId"
              element={
                <CoachRoute>
                  <AthleteDetail />
                </CoachRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
