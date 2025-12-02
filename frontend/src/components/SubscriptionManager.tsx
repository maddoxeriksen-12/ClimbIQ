import { useState } from 'react'
import { api } from '../lib/api'

interface SubscriptionManagerProps {
  currentTier: 'free' | 'premium'
}

export function SubscriptionManager({ currentTier }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async (priceId: string) => {
    setLoading(true)
    try {
      const response = await api.post('/api/v1/subscriptions/checkout', {
        price_id: priceId,
        success_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancel`,
      })

      window.location.href = response.data.checkout_url
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/v1/subscriptions/portal', {
        return_url: window.location.href,
      })

      window.location.href = response.data.portal_url
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setLoading(false)
    }
  }

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      features: [
        'Basic session logging',
        'Performance tracking',
        'Limited recommendations',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$9.99/mo',
      priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM as string,
      features: [
        'Everything in Free',
        'Personalized ML recommendations',
        'Advanced analytics',
        'Nutrition tracking',
      ],
    },
  ]

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Subscription</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 rounded-lg border-2 ${
              currentTier === plan.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200'
            }`}
          >
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="text-2xl font-bold mt-2">{plan.price}</p>

            <ul className="mt-4 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center text-sm">
                  <span className="mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {currentTier === plan.id ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-gray-200 rounded"
                >
                  {plan.id === 'free' ? 'Current Plan' : 'Manage'}
                </button>
              ) : plan.priceId ? (
                <button
                  onClick={() => handleUpgrade(plan.priceId!)}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {loading ? 'Loading...' : 'Upgrade'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
