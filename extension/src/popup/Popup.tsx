import { useState, useEffect } from 'react'

type Tone = 'Professional' | 'Casual' | 'Direct'

interface ProfileData {
  name: string
  headline: string
  company: string
  education?: string
  about?: string
}

interface Drafts {
  draft1: string
  draft2: string
}

export default function Popup() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [tone, setTone] = useState<Tone>('Professional')
  const [drafts, setDrafts] = useState<Drafts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<1 | 2 | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) return
      chrome.tabs.sendMessage(tabId, { type: 'GET_PROFILE' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          setError("Couldn't read this profile. Try refreshing the page.")
          return
        }
        if (response.error) {
          setError(response.error)
          return
        }
        setProfile(response.data)
      })
    })
  }, [])

  const generate = async () => {
    if (!profile) return
    setLoading(true)
    setDrafts(null)
    setError(null)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE',
        profile,
        tone,
      })
      if (!response) throw new Error('No response from background service worker')
      if (response.error) throw new Error(response.error)
      setDrafts(response.drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async (text: string, which: 1 | 2) => {
    await navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="w-80 bg-white font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-gray-900 text-sm tracking-wide">LinkNote</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Profile summary */}
        {profile ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">Connecting with</p>
            <p className="text-sm font-medium text-gray-900">{profile.name}</p>
            <p className="text-xs text-gray-500">{profile.headline}{profile.company ? ` · ${profile.company}` : ''}</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">Reading profile...</p>
          </div>
        )}

        {/* Tone selector */}
        <div>
          <label htmlFor="tone-select" className="text-xs text-gray-500 mb-1 block">Tone</label>
          <select
            id="tone-select"
            name="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Professional</option>
            <option>Casual</option>
            <option>Direct</option>
          </select>
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!profile || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          {loading ? 'Generating...' : 'Generate Message'}
        </button>

        {/* Drafts */}
        {drafts && (
          <div className="space-y-3 pt-1">
            {([1, 2] as const).map((n) => {
              const text = n === 1 ? drafts.draft1 : drafts.draft2
              return (
                <div key={n} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Draft {n}</span>
                    <span className={`text-xs ${text.length > 300 ? 'text-red-500' : 'text-gray-400'}`}>
                      {text.length}/300
                    </span>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      const updated = { ...drafts }
                      if (n === 1) updated.draft1 = e.target.value
                      else updated.draft2 = e.target.value
                      setDrafts(updated)
                    }}
                    rows={4}
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />
                  <button
                    onClick={() => copy(text, n)}
                    className="w-full text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 py-1.5 rounded-md transition-colors"
                  >
                    {copied === n ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
