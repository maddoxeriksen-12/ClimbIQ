// Auto-save form draft functionality for Pre-Session Form
// Helps prevent data loss if user navigates away

import React from 'react'

const DRAFT_KEY = 'climbiq_presession_draft'
const TIMESTAMP_KEY = 'climbiq_presession_draft_timestamp'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

export interface FormDraft {
    data: Record<string, unknown>
    timestamp: number
}

/**
 * Save form data to localStorage as a draft
 */
export function saveDraft(formData: Record<string, unknown>): void {
    try {
        const draft: FormDraft = {
            data: formData,
            timestamp: Date.now(),
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        localStorage.setItem(TIMESTAMP_KEY, draft.timestamp.toString())
    } catch (err) {
        console.error('Failed to save draft:', err)
    }
}

/**
 * Load form draft from localStorage
 */
export function loadDraft(): FormDraft | null {
    try {
        const draftStr = localStorage.getItem(DRAFT_KEY)
        if (!draftStr) return null

        const draft = JSON.parse(draftStr) as FormDraft
        return draft
    } catch (err) {
        console.error('Failed to load draft:', err)
        return null
    }
}

/**
 * Clear the form draft from localStorage
 */
export function clearDraft(): void {
    try {
        localStorage.removeItem(DRAFT_KEY)
        localStorage.removeItem(TIMESTAMP_KEY)
    } catch (err) {
        console.error('Failed to clear draft:', err)
    }
}

/**
 * Check if a draft exists and is recent (within 24 hours)
 */
export function hasDraft(): boolean {
    const draft = loadDraft()
    if (!draft) return false

    const now = Date.now()
    const ageMs = now - draft.timestamp
    const ageHours = ageMs / (1000 * 60 * 60)

    // Only show drafts less than 24 hours old
    return ageHours < 24
}

/**
 * Get how long ago the draft was saved
 */
export function getDraftAge(): string | null {
    const draft = loadDraft()
    if (!draft) return null

    const now = Date.now()
    const ageMs = now - draft.timestamp
    const ageMinutes = Math.floor(ageMs / (1000 * 60))

    if (ageMinutes < 1) return 'just now'
    if (ageMinutes < 60) return `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`

    const ageHours = Math.floor(ageMinutes / 60)
    if (ageHours < 24) return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`

    const ageDays = Math.floor(ageHours / 24)
    return `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`
}

/**
 * Hook for auto-saving form data
 */
export function useAutoSave(
    formData: Record<string, unknown>,
    enabled: boolean = true
): { lastSaved: number | null; saveNow: () => void } {
    const [lastSaved, setLastSaved] = React.useState<number | null>(null)

    React.useEffect(() => {
        if (!enabled) return

        const interval = setInterval(() => {
            saveDraft(formData)
            setLastSaved(Date.now())
        }, AUTO_SAVE_INTERVAL)

        return () => clearInterval(interval)
    }, [formData, enabled])

    const saveNow = React.useCallback(() => {
        saveDraft(formData)
        setLastSaved(Date.now())
    }, [formData])

    return { lastSaved, saveNow }
}

// Note: Add this import at the top of the file when using in React components
// import React from 'react'
