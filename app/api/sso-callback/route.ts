import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ssoToken = searchParams.get('sso_token');
  const ssoRefresh = searchParams.get('sso_refresh');
  const redirectTo = searchParams.get('redirect_to') || '/';
  
  console.log('[SSO CALLBACK] Received:', {
    hasSsoToken: !!ssoToken,
    hasSsoRefresh: !!ssoRefresh,
    redirectTo
  });
  
  if (!ssoToken) {
    console.error('[SSO CALLBACK] No sso_token provided');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Create response with redirect
  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  
  // Set cookies
  response.cookies.set('manaboodle_sso_token', ssoToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  
  if (ssoRefresh) {
    response.cookies.set('manaboodle_sso_refresh', ssoRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
  }
  
  console.log('[SSO CALLBACK] Cookies set, redirecting to:', redirectTo);
  
  return response;
}
