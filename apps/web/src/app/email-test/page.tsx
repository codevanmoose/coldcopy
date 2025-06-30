'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Mail, CheckCircle, XCircle } from 'lucide-react'

export default function EmailTestPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; suggestion?: string } | null>(null)

  const sendTestEmail = async () => {
    if (!email) {
      setResult({ success: false, message: 'Please enter an email address' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: data.message })
      } else {
        setResult({ 
          success: false, 
          message: data.error || 'Failed to send email',
          suggestion: data.suggestion
        })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error - please try again' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Email Test</CardTitle>
            <CardDescription>
              Send a test email to verify your Amazon SES configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendTestEmail()}
                />
                <Button
                  onClick={sendTestEmail}
                  disabled={loading || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>

            {result && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  result.success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-5 w-5 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.suggestion && (
                    <p className="text-sm mt-1 opacity-90">{result.suggestion}</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">Note:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Make sure the email address is verified in SES if in sandbox mode</li>
                <li>• Check your spam folder if you don't see the email</li>
                <li>• The email will be sent from: noreply@coldcopy.cc</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}