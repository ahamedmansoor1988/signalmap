const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqRequest {
  model: string
  max_tokens: number
  messages: GroqMessage[]
  temperature?: number
}

interface GroqResponse {
  choices: Array<{ message: { content: string } }>
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

async function callGroq(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const body: GroqRequest = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as GroqResponse
  return data.choices[0]?.message?.content ?? ''
}

export async function callClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<T> {
  const raw = await callGroq(systemPrompt, userMessage, maxTokens)
  return JSON.parse(stripFences(raw)) as T
}

export { callGroq as callClaude }
