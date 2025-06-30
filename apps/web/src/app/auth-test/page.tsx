'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthTestPage() {
  const [status, setStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      
      // Check if Supabase is initialized
      const supabaseOk = !!supabase;
      
      // Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // Check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      setStatus({
        timestamp: new Date().toISOString(),
        supabase: {
          initialized: supabaseOk,
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
        },
        auth: {
          user: user ? `✅ Logged in as ${user.email}` : '❌ Not logged in',
          userError: userError?.message,
          session: session ? '✅ Active session' : '❌ No session',
          sessionError: sessionError?.message,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'Not set',
        }
      });
      
      setLoading(false);
    }
    
    checkAuth();
  }, []);
  
  const handleSignup = () => {
    window.location.href = '/signup';
  };
  
  const handleLogin = () => {
    window.location.href = '/login';
  };
  
  const handleDashboard = () => {
    window.location.href = '/dashboard';
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">ColdCopy Authentication Test</h1>
        
        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading authentication status...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Current Status</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(status, null, 2)}
              </pre>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Test Authentication Flow</h2>
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleSignup}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 mr-4"
                  >
                    Go to Signup
                  </button>
                  <span className="text-gray-600">Create a new account</span>
                </div>
                
                <div>
                  <button
                    onClick={handleLogin}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 mr-4"
                  >
                    Go to Login
                  </button>
                  <span className="text-gray-600">Sign in to existing account</span>
                </div>
                
                <div>
                  <button
                    onClick={handleDashboard}
                    className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 mr-4"
                  >
                    Go to Dashboard
                  </button>
                  <span className="text-gray-600">Should redirect to login if not authenticated</span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h3>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>Email confirmation may be required after signup</li>
                <li>Check your email spam folder if confirmation doesn't arrive</li>
                <li>Email sending requires Amazon SES configuration</li>
                <li>Some features require additional API keys (OpenAI, Stripe, etc.)</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}