import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'

type Bindings = {
  ANTHROPIC_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: (origin) => origin?.startsWith('chrome-extension://') ? origin : null,
  allowMethods: ['POST'],
  allowHeaders: ['Content-Type'],
}))

app.post('/api/generate', async (c) => {
  try {
    const { system, user } = await c.req.json<{ system: string; user: string }>()

    if (!system || !user) {
      return c.json({ error: 'Missing prompt' }, 400)
    }

    const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return c.json({ error: 'Failed to parse model response' }, 500)
    }

    const drafts = JSON.parse(jsonMatch[0]) as { draft1: string; draft2: string }
    return c.json(drafts)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 500)
  }
})

export default app
