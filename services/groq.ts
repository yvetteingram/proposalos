// ─── GROQ CLIENT ─────────────────────────────────────────────────────────────
// Uses native fetch — no SDK required per Ketorah Digital standards.
// Model: llama-3.3-70b-versatile across all Ketorah apps.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const getApiKey = () => {
  const key = import.meta.env.VITE_GROQ_API_KEY as string
  if (!key) throw new Error('Missing VITE_GROQ_API_KEY in .env.local')
  return key
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callGroq(
  messages: GroqMessage[],
  temperature = 0.7,
  maxTokens = 2048,
  retries = 3,
  delayMs = 5000
): Promise<string> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const isRateLimit = response.status === 429

      if (isRateLimit && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return callGroq(messages, temperature, maxTokens, retries - 1, delayMs * 2)
      }

      throw new Error(`Groq API error ${response.status}: ${JSON.stringify(err)}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content ?? ''

  } catch (error) {
    if (retries > 0 && error instanceof TypeError) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return callGroq(messages, temperature, maxTokens, retries - 1, delayMs)
    }
    throw error
  }
}