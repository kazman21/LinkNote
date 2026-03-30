import { buildPrompt, type Tone } from '../utils/prompt-builder'
import type { ProfileData } from '../utils/templates'

const API_URL = 'https://linknote-api.linknote.workers.dev/api/generate'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GENERATE') return

  const { profile, tone }: { profile: ProfileData; tone: Tone } = message

  ;(async () => {
    try {
      const { system, user } = buildPrompt(profile, tone)
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, user }),
      })
      if (!res.ok) {
        const raw = await res.text()
        throw new Error(`Server error: ${res.status} — ${raw}`)
      }
      const data = await res.json() as { draft1: string; draft2: string }
      sendResponse({ drafts: data })
    } catch (e) {
      console.error('[LinkNote] error', e)
      sendResponse({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  })()

  return true // keep message channel open for async response
})
