import { useState } from 'react'
import { api } from '../lib/api'

interface SubscriptionManagerProps {
  currentTier: 'free' | 'premium'
}

export function SubscriptionManager({ currentTier }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async (priceId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/v1/subscriptions/checkout', {
        price_id: priceId,
        success_url: `${window.location.origin}/settings?tab=subscription&status=success`,
        cancel_url: `${window.location.origin}/settings?tab=subscription&status=cancelled`,
      })
      window.location.href = response.data.checkout_url
    } catch (err) {
      setError('Failed to start checkout. Please try again.')
      console.error('Checkout error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/v1/subscriptions/portal', {
        return_url: window.location.href,
      })
      window.location.href = response.data.portal_url
    } catch (err) {
      setError('Failed to open billing portal. Please try again.')
      console.error('Portal error:', err)
    } finally {
      setLoading(false)
    }
  }

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        { text: 'Basic session logging', included: true },
        { text: 'Performance tracking', included: true },
        { text: 'Up to 10 sessions/month', included: true },
        { text: 'ML recommendations', included: false },
        { text: 'Advanced analytics', included: false },
        { text: 'Priority support', included: false },
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$9.99',
      period: '/month',
      description: 'For serious climbers',
      priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM as string,
      popular: true,
      features: [
        { text: 'Unlimited session logging', included: true },
        { text: 'Performance tracking', included: true },
        { text: 'Unlimited sessions', included: true },
        { text: 'ML recommendations', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority support', included: true },
      ],
    },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Subscription Plans</h2>
        <p className="text-slate-400 text-sm">Choose the plan that fits your climbing goals.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 transition-all ${
              currentTier === plan.id
                ? 'border-fuchsia-500/50 bg-gradient-to-b from-fuchsia-500/10 to-transparent'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-xs font-medium">
                  Most Popular
                </span>
              </div>
            )}

            {/* Current plan badge */}
            {currentTier === plan.id && (
              <div className="absolute top-4 right-4">
                <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-medium">
                  Current
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-slate-400">{plan.period}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm">
                  {feature.included ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                      ✓
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 text-slate-600 flex items-center justify-center text-xs">
                      ✕
                    </span>
                  )}
                  <span className={feature.included ? 'text-slate-200' : 'text-slate-500'}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            <div>
              {currentTier === plan.id ? (
                plan.id === 'premium' ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Loading...' : 'Manage Subscription'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 px-4 rounded-xl bg-white/5 text-slate-500 text-sm font-medium cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                )
              ) : plan.priceId ? (
                <button
                  onClick={() => handleUpgrade(plan.priceId!)}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-sm font-semibold hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Loading...' : 'Upgrade to Premium'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* FAQ or additional info */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <p className="text-sm text-slate-400 text-center">
          Questions? Contact us at{' '}
          <a href="mailto:support@climbiq.app" className="text-fuchsia-400 hover:text-fuchsia-300">
            support@climbiq.app
          </a>
        </p>
      </div>
    </div>
  )
}
