import { NextResponse } from 'next/server'

export async function GET() {
  // Check which AI-related environment variables are configured
  const config = {
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      keyPreview: process.env.OPENAI_API_KEY ? 
        `${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.slice(-4)}` : 
        'Not configured',
    },
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      keyPreview: process.env.ANTHROPIC_API_KEY ? 
        `${process.env.ANTHROPIC_API_KEY.substring(0, 7)}...${process.env.ANTHROPIC_API_KEY.slice(-4)}` : 
        'Not configured',
    },
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  }

  return NextResponse.json({
    status: 'AI Configuration Check',
    config,
    message: config.openai.configured && config.anthropic.configured ? 
      '✅ All AI providers are configured' : 
      '⚠️ Some AI providers are not configured',
  })
}