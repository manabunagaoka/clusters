import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/login', request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  // Clear SSO cookies
  response.cookies.delete('manaboodle_sso_token');
  response.cookies.delete('manaboodle_sso_refresh');
  
  console.log('[LOGOUT] Cookies cleared, redirecting to login');
  
  return response;
}
