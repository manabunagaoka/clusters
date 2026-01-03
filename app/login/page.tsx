"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect_to') || '/';
  
  const handleLogin = () => {
    const origin = window.location.origin;
    const callbackUrl = `${origin}/api/sso-callback?redirect_to=${encodeURIComponent(redirectTo)}`;
    const loginUrl = `https://www.manaboodle.com/academic-portal/login?return_url=${encodeURIComponent(callbackUrl)}&app_name=Clusters`;
    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#059669]/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#059669]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Login card */}
      <div className="relative bg-[#0f172a]/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#059669] via-[#10b981] to-[#059669] bg-clip-text text-transparent mb-2">
            Clusters
          </h1>
          <p className="text-slate-400 text-sm">JTBD Student Edition by Manaboodle</p>
        </div>

        {/* Welcome text */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">
            Welcome Back
          </h2>
          <p className="text-slate-400 text-sm">
            Sign in with your Manaboodle account to continue
          </p>
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-[#059669] hover:bg-[#10b981] text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          Log in with Manaboodle
        </button>

        <p className="text-xs text-slate-500 text-center mt-4">
          Secure authentication via Manaboodle Academic Portal
        </p>

        {/* Create account link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <a
              href="https://www.manaboodle.com/academic-portal/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#059669] hover:underline"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
