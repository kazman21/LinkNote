interface ProfileData {
  name: string
  headline: string
  company: string
  education?: string
  about?: string
}

function getText(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

function scrapeProfile(): ProfileData | null {
  // Name — LinkedIn renders the name in an h1 inside the top card
  // Try multiple selectors in order of specificity (LinkedIn changes classes often)
  const nameEl =
    document.querySelector('h1') ??
    document.querySelector('main h1') ??
    document.querySelector('main h2') ??
    document.querySelector('h1.text-heading-xlarge') ??
    document.querySelector('.pv-text-details__left-panel h1')

  const name = getText(nameEl)
  if (!name) return null

  // Headline — the div immediately below the name with the job title
  const headlineEl =
    document.querySelector('.text-body-medium.break-words') ??
    nameEl?.closest('div')?.nextElementSibling ??
    document.querySelector('[data-field="headline"]')
  const headline = getText(headlineEl)

  // Company — try experience section first, then parse headline
  let company = ''
  const expSection = document.querySelector('#experience')?.closest('section')
  if (expSection) {
    // Each experience item has a span for company name (aria-hidden="true" spans)
    const spans = expSection.querySelectorAll('span[aria-hidden="true"]')
    // Company name is usually the second span (first is role title)
    if (spans.length >= 2) company = getText(spans[1])
    if (!company && spans.length >= 1) company = getText(spans[0])
  }
  // Fallback: parse "at Company" or "@ Company" from headline
  if (!company && headline) {
    const match = headline.match(/(?:\bat\b|@)\s+(.+)$/i)
    if (match) company = match[1].trim()
  }
  // Fallback: institution shown next to name (the logo link alt text)
  if (!company) {
    const orgLink = document.querySelector('.pv-text-details__left-panel .org-top-card-summary-info-list__info-item')
    if (orgLink) company = getText(orgLink)
  }

  // Education — first school name from education section
  let education: string | undefined
  const eduSection = document.querySelector('#education')?.closest('section')
  if (eduSection) {
    const spans = eduSection.querySelectorAll('span[aria-hidden="true"]')
    if (spans.length) education = getText(spans[0])
  }

  // About — first 200 chars from about section
  let about: string | undefined
  const aboutSection = document.querySelector('#about')?.closest('section')
  if (aboutSection) {
    // LinkedIn truncates with a "see more" button; get the full span text
    const spans = aboutSection.querySelectorAll('span[aria-hidden="true"]')
    for (const span of spans) {
      const t = getText(span)
      if (t.length > 20) { about = t.slice(0, 200); break }
    }
  }

  return { name, headline, company, education, about }
}

function waitForProfile(timeoutMs: number): Promise<ProfileData | null> {
  return new Promise((resolve) => {
    // Try immediately first
    const immediate = scrapeProfile()
    if (immediate) { resolve(immediate); return }

    const deadline = Date.now() + timeoutMs
    const observer = new MutationObserver(() => {
      const data = scrapeProfile()
      if (data) {
        observer.disconnect()
        resolve(data)
      } else if (Date.now() >= deadline) {
        observer.disconnect()
        resolve(null)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Hard timeout fallback
    setTimeout(() => {
      observer.disconnect()
      resolve(scrapeProfile())
    }, timeoutMs)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_PROFILE') return

  waitForProfile(5000).then((data) => {
    if (!data) {
      console.warn('[LinkNote] scrapeProfile returned null', { url: location.href })
      sendResponse({ error: "Couldn't read this profile. Make sure you're on a LinkedIn profile page and try again." })
      return
    }
    sendResponse({ data })
  })

  return true // keep channel open for async response
})
