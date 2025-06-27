/**
 * White-Label Login Page
 * 
 * Custom login page for white-label domains with branded styling
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";

export default function WhiteLabelLoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  const headersList = headers();
  const isAuthenticated = headersList.get('x-authenticated') === 'true';
  
  // Redirect authenticated users
  if (isAuthenticated) {
    const redirectTo = searchParams.redirectTo || '/white-label/dashboard';
    redirect(redirectTo);
  }

  const branding = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : 'Your Company',
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    primaryColor: headersList.get('x-brand-primary-color') || '#2563eb',
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.companyName} Logo`}
              className="mx-auto h-12 w-auto mb-4"
            />
          ) : (
            <div 
              className="mx-auto w-12 h-12 rounded-lg mb-4 flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {branding.companyName.charAt(0)}
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sign in to {branding.companyName}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Welcome back! Please sign in to your account.
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/auth/login" method="post" className="space-y-4">
              <input 
                type="hidden" 
                name="redirectTo" 
                value={searchParams.redirectTo || '/white-label/dashboard'} 
              />
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                    Remember me
                  </label>
                </div>
                <a
                  href="/white-label/forgot-password"
                  className="text-sm hover:underline"
                  style={{ color: branding.primaryColor }}
                >
                  Forgot password?
                </a>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Sign In
              </Button>
            </form>

            <Separator />

            {/* Social Login Options */}
            <div className="space-y-3">
              <Button variant="outline" className="w-full" type="button">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
              
              <Button variant="outline" className="w-full" type="button">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <a
                href="/white-label/signup"
                className="font-medium hover:underline"
                style={{ color: branding.primaryColor }}
              >
                Sign up
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Terms and Privacy */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          By signing in, you agree to our{' '}
          <a href="/terms" className="hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}