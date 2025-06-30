'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SESSetupPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSESStatus();
  }, []);

  const checkSESStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ses-status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to check SES status:', error);
      setStatus({ status: 'error', message: 'Failed to check SES status' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (value: string) => {
    if (value.startsWith('✅')) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (value.startsWith('❌')) return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Amazon SES Setup Status</h1>
        <p className="text-gray-600 mb-8">Configure email sending for ColdCopy</p>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-600">Checking SES configuration...</span>
          </div>
        ) : status ? (
          <>
            {/* Status Card */}
            <div className={`rounded-lg shadow p-6 mb-6 ${
              status.status === 'connected' ? 'bg-green-50 border border-green-200' :
              status.status === 'not_configured' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <h2 className="text-xl font-semibold mb-2 flex items-center">
                {status.status === 'connected' && <CheckCircle className="w-6 h-6 text-green-600 mr-2" />}
                {status.status === 'not_configured' && <AlertCircle className="w-6 h-6 text-yellow-600 mr-2" />}
                {status.status === 'error' && <XCircle className="w-6 h-6 text-red-600 mr-2" />}
                {status.message}
              </h2>
              
              {status.error && (
                <div className="mt-4 p-4 bg-red-100 rounded text-red-700">
                  <strong>Error:</strong> {status.error}
                </div>
              )}
            </div>

            {/* Configuration Status */}
            {status.config && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Configuration Status</h3>
                <div className="space-y-3">
                  {Object.entries(status.config).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-gray-600">{key.replace(/_/g, ' ')}:</span>
                      <div className="flex items-center">
                        {getStatusIcon(value as string)}
                        <span className="ml-2 font-mono text-sm">{value as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {status.nextSteps && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3 text-blue-900">Next Steps</h3>
                <ol className="list-decimal list-inside space-y-2 text-blue-800">
                  {status.nextSteps.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Troubleshooting */}
            {status.troubleshooting && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3 text-orange-900">Troubleshooting</h3>
                <ul className="list-disc list-inside space-y-2 text-orange-800">
                  {status.troubleshooting.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Setup Guide */}
            <div className="bg-gray-100 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Setup Guide</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. AWS Console Links:</h4>
                  <div className="space-x-4">
                    <a 
                      href="https://console.aws.amazon.com/ses/home?region=us-east-1#/verified-identities" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Verify Domain →
                    </a>
                    <a 
                      href="https://console.aws.amazon.com/ses/home?region=us-east-1#/account" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Request Production Access →
                    </a>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">2. Required Environment Variables:</h4>
                  <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
{`AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@coldcopy.cc
SES_CONFIGURATION_SET=coldcopy-transactional`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">3. Test Email Sending:</h4>
                  <button
                    onClick={checkSESStatus}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Refresh Status
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-red-50 rounded-lg p-6 text-red-700">
            Failed to load SES status
          </div>
        )}
      </div>
    </div>
  );
}