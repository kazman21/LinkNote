import type { ProfileData } from './templates'
import { selectTemplate } from './templates'

export type Tone = 'Professional' | 'Casual' | 'Direct'

const SYSTEM_PROMPT = `You generate short LinkedIn connection request messages. Rules:
- Produce exactly 2 drafts as JSON: {"draft1": "...", "draft2": "..."}
- Each draft must be under 300 characters
- Reference at least one specific detail from the profile (not just the name)
- Never use: "I came across your profile", "pick your brain", "synergize", "touch base", "leverage", "hope this finds you"
- Draft 1: leads with their work or company
- Draft 2: leads with shared background or a direct ask
- Do not add quotes around the message text`

export function buildPrompt(profile: ProfileData, tone: Tone): { system: string; user: string } {
  const template = selectTemplate(profile)

  const profileSummary = [
    `Name: ${profile.name}`,
    `Headline: ${profile.headline}`,
    profile.company ? `Company: ${profile.company}` : null,
    profile.education ? `Education: ${profile.education}` : null,
    profile.about ? `About (excerpt): ${profile.about}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const user = `Generate 2 LinkedIn connection request messages.

Profile:
${profileSummary}

Tone: ${tone}
Template frame: ${template}

Return only valid JSON with keys draft1 and draft2.`

  return { system: SYSTEM_PROMPT, user }
}
