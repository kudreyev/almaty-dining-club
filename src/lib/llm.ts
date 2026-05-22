import { logServerError } from '@/lib/safe-errors'

/** Простой клиент OpenAI Chat Completions без SDK. */
export async function completeChat(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      logServerError('llm:completeChat', new Error(`${res.status}: ${await res.text()}`))
      return null
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const text = body.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (error) {
    logServerError('llm:completeChat', error)
    return null
  }
}
