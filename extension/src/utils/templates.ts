export type TemplateFrame = 'role_interest' | 'shared_background' | 'alumni' | 'recruiter'

export interface ProfileData {
  name: string
  headline: string
  company: string
  education?: string
  about?: string
}

export function selectTemplate(profile: ProfileData, userEducation?: string): TemplateFrame {
  if (userEducation && profile.education) {
    const match = profile.education.toLowerCase().includes(userEducation.toLowerCase())
    if (match) return 'alumni'
  }
  return 'role_interest'
}
