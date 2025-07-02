import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model = 'gpt-4', prompt, leadData } = body

    // Test OpenAI
    if (model.includes('gpt')) {
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at writing professional cold emails. Write a compelling cold email that is personalized and likely to get a positive response.'
            },
            {
              role: 'user',
              content: prompt || `Write a cold email to ${leadData?.name || 'John Smith'} at ${leadData?.company || 'TechCorp Inc'}. Their title is ${leadData?.title || 'VP of Sales'}. Our goal is to schedule a demo of our sales automation platform. Keep it professional and concise.`
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return NextResponse.json({ error: `OpenAI API error: ${error}` }, { status: response.status })
      }

      const data = await response.json()
      return NextResponse.json({
        model: 'gpt-4',
        content: data.choices[0].message.content,
        usage: data.usage,
        provider: 'openai',
        success: true
      })
    }

    // Test Anthropic
    if (model.includes('claude')) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicKey) {
        return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt || `Write a cold email to ${leadData?.name || 'John Smith'} at ${leadData?.company || 'TechCorp Inc'}. Their title is ${leadData?.title || 'VP of Sales'}. Our goal is to schedule a demo of our sales automation platform. Keep it professional and concise.`
            }
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return NextResponse.json({ error: `Anthropic API error: ${error}` }, { status: response.status })
      }

      const data = await response.json()
      return NextResponse.json({
        model: 'claude-3-sonnet',
        content: data.content[0].text,
        usage: data.usage,
        provider: 'anthropic',
        success: true
      })
    }

    return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 })

  } catch (error) {
    console.error('AI generation test error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Generation Test Endpoint',
    usage: 'POST to this endpoint with { "model": "gpt-4" | "claude", "prompt": "...", "leadData": {...} }'
  })
}