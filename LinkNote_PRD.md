# LinkNote — Product Requirements Document

**Version:** 1.0  
**Author:** Munaf  
**Last Updated:** March 2026  
**Status:** Draft — MVP Scoping

---

## 1. Problem

Writing LinkedIn connection requests is a small but persistent friction point. Most users fall into one of two traps: they send the default blank request (which gets ignored) or they spend several minutes crafting a message (which doesn't scale). The result is the same — low acceptance rates and missed opportunities.

LinkNote is a Chrome extension that reads the LinkedIn profile a user is currently viewing and generates a short, personalized connection message they can copy and send. It does one thing and does it well.

---

## 2. Who This Is For

**Primary audience — people who send connection requests regularly:**

- Students looking for internships or mentorship. They often don't know *what* to say to someone senior and default to awkward or overly formal messages.
- Job seekers doing targeted outreach to hiring managers or team leads.
- Recruiters who need volume without sounding like a mail merge.

**Secondary audience (V2 consideration):**

- Founders doing cold outreach to potential partners, investors, or hires.
- Sales professionals (B2B). This is a large market but changes the product's tone and positioning significantly — intentionally deferred.

**Non-users:** Anyone who automates LinkedIn actions (auto-connect, auto-message). LinkNote is explicitly *not* an automation tool. The user always copies and sends manually.

---

## 3. User Journey

This is the core loop. Every design and technical decision should serve it.

```
User lands on a LinkedIn profile
        ↓
Clicks the LinkNote extension icon
        ↓
Extension reads the visible profile data (name, headline, company, education, about section)
        ↓
User picks a tone (Professional / Casual / Direct) — defaults to Professional
        ↓
Extension generates 2 message drafts (not 3 — reduces decision fatigue)
        ↓
User can edit either draft inline
        ↓
Clicks "Copy" → message is on clipboard
        ↓
User pastes into LinkedIn's "Add a note" box and sends
```

**Key design decisions embedded here:**

- **2 drafts, not 3.** Three creates a paradox of choice for a 300-character message. Two gives a meaningful contrast (e.g. one that leads with shared background, one that leads with their work) without overwhelming.
- **Tone selector before generation, not after.** Re-generating wastes an API call and adds latency. Let the user set the tone upfront.
- **Editable drafts.** Users should always feel ownership over what they send. The generated text is a starting point, not a final product.
- **No auto-inject into LinkedIn's UI.** This is a deliberate constraint. Injecting text into LinkedIn's composer risks breakage with every LinkedIn UI update and puts the extension at higher risk of being flagged. Copy-paste is reliable and keeps us on the right side of LinkedIn's policies.

---

## 4. MVP Feature Set

### 4.1 Profile Data Extraction

The content script reads the DOM of the currently viewed LinkedIn profile and extracts:

| Field | Source | Required |
|---|---|---|
| Name | Profile header | Yes |
| Headline / Job title | Below name | Yes |
| Current company | Experience section or headline | Yes |
| Education | Education section | No |
| About / Summary | About section (first ~200 chars) | No |
| Mutual connections | Sidebar or mutual section | No |

**What we deliberately skip:** Posts, activity, endorsements, skills list. These add noise to the prompt without improving message quality for a short connection request.

**Edge cases to handle:**

- Private profiles or profiles with limited visibility → show a message: "Not enough info on this profile to generate a message. Try adding a personal note yourself."
- Non-English profiles → V1 generates in English only. Detect non-Latin scripts and show a disclaimer.
- Company pages, group pages, or non-profile URLs → extension icon stays inactive.

### 4.2 Message Generation

Each generation call produces 2 drafts. Drafts must:

- Be under 300 characters (LinkedIn's connection note limit).
- Reference at least one specific detail from the profile (name alone doesn't count).
- Avoid clichés: "I came across your profile," "I'd love to pick your brain," "Let's synergize."
- Match the selected tone.

**Tone options (MVP):**

| Tone | Description | Example opening |
|---|---|---|
| Professional | Polished, respectful, suitable for senior contacts | "Hi Sarah — your work on supply chain optimization at Deloitte caught my eye..." |
| Casual | Warm, peer-to-peer energy | "Hey Sarah! Saw you're working on supply chain stuff at Deloitte — that's really cool..." |
| Direct | Short, no fluff, gets to the point | "Hi Sarah — I'm a logistics student at TUS interested in supply chain roles. Would love to connect." |

**Why no "Friendly" tone:** In testing, "Friendly" and "Casual" produce nearly identical outputs. Three meaningfully distinct tones are better than four overlapping ones.

### 4.3 Template Layer

Before hitting the AI API, the system selects a template frame based on available profile data. This improves consistency and reduces reliance on the model to structure the message.

**Template categories:**

- **Shared background** — triggered when education or location overlap is detected. Leads with commonality.
- **Role interest** — default. Leads with genuine interest in their work or company.
- **Alumni** — triggered when same university is detected. Leads with the shared institution.
- **Recruiter** — user-selectable. Frames the message as a hiring/talent inquiry.

The AI fills in the template with profile-specific details and adjusts for tone. This hybrid approach (template structure + AI personalization) is more reliable than pure free-generation for short-form text.

### 4.4 UI — Extension Popup

**Layout (single panel, no tabs for MVP):**

```
┌─────────────────────────────────┐
│  LinkNote                    ⚙  │
├─────────────────────────────────┤
│                                 │
│  Connecting with: Sarah Chen    │
│  PM @ Deloitte · TCD Alumni     │
│                                 │
│  Tone: [Professional ▾]        │
│                                 │
│  [ Generate Message ]           │
│                                 │
├─────────────────────────────────┤
│  Draft 1                        │
│  ┌─────────────────────────┐    │
│  │ Editable text area      │    │
│  └─────────────────────────┘    │
│                    [Copy]  ✓    │
│                                 │
│  Draft 2                        │
│  ┌─────────────────────────┐    │
│  │ Editable text area      │    │
│  └─────────────────────────┘    │
│                    [Copy]  ✓    │
│                                 │
│  ───────────────────────────    │
│  3 / 5 free messages today      │
└─────────────────────────────────┘
```

**UI principles:**

- No onboarding flow. The UI is self-explanatory.
- No login for free tier. Generations are tracked by a local anonymous ID stored in chrome.storage.
- The "Connecting with" summary confirms the right profile was read — builds trust.
- Character count shown on each draft (LinkedIn's 300 char limit).
- Copy button shows a checkmark for 2 seconds after click — confirms the action.

---

## 5. Technical Architecture

### 5.1 Extension Structure (Manifest V3)

```
linknote/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── scraper.js          # Content script — reads LinkedIn DOM
├── background/
│   └── service-worker.js   # Handles API calls, usage tracking
├── utils/
│   ├── templates.js         # Template frames
│   └── prompt-builder.js    # Constructs the AI prompt
└── icons/
```

### 5.2 Data Flow

```
LinkedIn DOM  →  content script (scraper.js)  →  message to service worker
     ↓
service worker builds prompt (template + profile data + tone)
     ↓
API call to AI provider  →  2 drafts returned
     ↓
popup.js renders drafts in editable textareas
     ↓
user clicks Copy  →  clipboard API  →  done
```

### 5.3 AI API

**Recommended for MVP: Anthropic Claude API (claude-sonnet-4-20250514)**

- Strong instruction-following for structured, short-form text.
- Reliable at staying within character limits.
- Cost-effective at this output length (~100 tokens per generation).

**Prompt strategy:**

The prompt should include the template frame, extracted profile data, selected tone, and explicit constraints (character limit, no clichés, must reference a specific detail). System prompt stays constant; user message varies per profile.

**API key handling:**

For MVP, the API key lives server-side behind a lightweight proxy. The extension calls your proxy endpoint, not the AI API directly. This prevents key exposure in the extension bundle.

```
Extension  →  POST /api/generate (your server)  →  AI API  →  response back
```

**Server (MVP — minimal):**

- Node.js + Express, single endpoint.
- Rate limiting per anonymous user ID (5 free/day).
- No database needed for MVP — rate limits can use in-memory store or Redis.

### 5.4 What We Don't Store

- No LinkedIn credentials.
- No profile data persisted server-side. Profile data is sent in the API request, used for generation, and discarded.
- No message history server-side.
- Usage count stored locally in chrome.storage.local.

---

## 6. Risks and Mitigations

### LinkedIn Platform Risk

**Risk:** LinkedIn detects and restricts the extension for scraping.

**Reality check:** Reading the visible DOM is what every browser extension does (ad blockers, accessibility tools, password managers). We're not using LinkedIn's API, not bypassing authentication, and not automating any actions. This is low-risk but not zero-risk.

**Mitigations:**
- Only read data that's already rendered in the DOM (no hidden API calls to LinkedIn endpoints).
- No automated clicking, form-filling, or message sending.
- Rate limit usage to prevent rapid-fire scraping patterns.
- If LinkedIn changes their DOM structure, the scraper breaks gracefully — show a "couldn't read this profile" message rather than crashing.

### AI Quality Risk

**Risk:** Generated messages sound generic or awkward.

**Mitigations:**
- Template layer provides structural consistency — the AI is filling in details, not writing from scratch.
- Explicit prompt constraints ban common clichés.
- Editable drafts let users fix anything that feels off.
- Log anonymized quality signals (did the user copy a draft? did they edit it first?) to improve prompts over time.

### Chrome Web Store Risk

**Risk:** Extension rejected during review.

**Mitigations:**
- Request only necessary permissions (activeTab, storage, clipboard).
- No broad host permissions — content script only activates on linkedin.com.
- Clear privacy policy explaining what data is read and that nothing is stored.

---

## 7. Success Metrics

**The one metric that matters for MVP: copy rate.** If users generate a message and then copy it, the product is working. Everything else is secondary.

| Metric | What it tells us | Target (Month 1) |
|---|---|---|
| Copy rate | Did the user find the output useful enough to use? | > 60% of generations result in a copy |
| Edit-before-copy rate | Is the AI output good enough as-is? | < 40% of copies are edited first |
| Daily active users | Is there a habit forming? | 50 DAU |
| Return rate (Day 7) | Do users come back? | > 30% |
| Generations per session | Are users trying it on multiple profiles? | > 1.5 |

**What we don't measure in MVP:** Connection acceptance rate. This requires the user to report outcomes, which adds friction. Defer to V2 as an opt-in tracking feature.

---

## 8. MVP Scope — What's In, What's Out

| In (MVP) | Out (V2+) |
|---|---|
| Profile data extraction from DOM | Bulk draft generation |
| 2 drafts per generation | Saved user persona / bio |
| 3 tone options | Follow-up message generation |
| Editable drafts | Analytics dashboard |
| Copy to clipboard | CRM-style contact tagging |
| Free tier with 5/day limit | Multi-language support |
| Lightweight proxy server | "Reason for connecting" suggestions |
| | Message rewrite / shorten buttons |
| | Payment integration |

**Rationale for cuts:** The MVP tests one hypothesis — *can AI generate LinkedIn connection messages that people actually want to send?* Everything else (personas, analytics, payments) is infrastructure for scaling something that hasn't been validated yet.

---

## 9. Monetization (Post-Validation)

Don't build payments into V1. Validate the product first.

**Planned model (V2):**

- **Free:** 5 generations/day. All 3 tones. No account required.
- **Pro (€6/month):** Unlimited generations. Saved persona. Priority generation speed. Template customization.

**Why €6, not €5 or €10:** €5 feels cheap and signals low value. €10 is a harder sell for students (primary audience). €6 is psychologically in the sweet spot — clearly not free, but low enough for a student budget.

**Payment integration:** Stripe Checkout via the proxy server. User creates an account only when upgrading to Pro.

---

## 10. Launch Plan

**Phase 1 — Private beta (Week 1–2):**
- Distribute to 20–30 classmates and LinkedIn contacts.
- Collect feedback on message quality and UI friction.
- Watch for scraper breakage across different profile types.

**Phase 2 — Public launch (Week 3–4):**
- Publish to Chrome Web Store.
- Post a build-in-public thread on LinkedIn (target: student and job-seeker audiences).
- Submit to Product Hunt.
- Short demo video (30–60 sec screen recording, no overproduction) for LinkedIn, TikTok, and relevant subreddits (r/cscareerquestions, r/linkedin, r/SideProject).

**Phase 3 — Iterate (Week 5+):**
- Improve prompt quality based on edit-before-copy patterns.
- Add the highest-requested feature from beta feedback.
- Explore paid tier if DAU exceeds 100.

---

## 11. Open Questions

These need answers before or during development:

1. **Should the extension auto-activate when it detects a LinkedIn profile, or only when the user clicks the icon?** Auto-activate is more discoverable but may feel intrusive. Leaning toward icon-click only.
2. **How do we handle LinkedIn's periodic DOM restructuring?** The scraper will break. Do we version the scraper selectors and push updates, or build a more resilient extraction layer (e.g., looking for ARIA labels rather than specific class names)?
3. **Is a proxy server truly necessary for MVP, or can we ship with the API key in the extension for a private beta and add the proxy before public launch?** The proxy is the right long-term architecture, but it adds hosting cost and complexity for a beta with 20 users.
4. **What's the fallback when the AI API is down?** Show a pre-written template the user can manually customize? Or just show an error and ask them to retry?
