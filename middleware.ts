// middleware.ts
// Manaboodle SSO Integration - DO NOT MODIFY VERIFICATION LOGIC

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// CONFIGURATION
// ============================================
const MANABOODLE_SSO_URL = process.env.NEXT_PUBLIC_MANABOODLE_URL || 'https://www.manaboodle.com';
const APP_NAME = 'Clusters';

// Optional: Paths that don't require authentication
const PUBLIC_PATHS = [
  '/health',
  '/api/health',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip authentication for public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  const token = request.cookies.get('manaboodle_sso_token')?.value;
  const ssoToken = request.nextUrl.searchParams.get('sso_token');
  
  // Handle SSO callback (user just logged in and returned from Manaboodle)
  if (ssoToken) {
    const response = NextResponse.redirect(new URL(request.nextUrl.pathname, request.url));
    
    // Store tokens in cookies
    response.cookies.set('manaboodle_sso_token', ssoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    const refreshToken = request.nextUrl.searchParams.get('sso_refresh');
    if (refreshToken) {
      response.cookies.set('manaboodle_sso_refresh', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }
    
    return response;
  }
  
  // No token? Redirect to SSO login
  if (!token) {
    const loginUrl = new URL(`${MANABOODLE_SSO_URL}/sso/login`);
    loginUrl.searchParams.set('return_url', request.url);
    loginUrl.searchParams.set('app_name', APP_NAME);
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify token with Manaboodle
  try {
    const verifyResponse = await fetch(`${MANABOODLE_SSO_URL}/api/sso/verify`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!verifyResponse.ok) {
      // Token invalid, clear cookies and redirect to login
      const loginUrl = new URL(`${MANABOODLE_SSO_URL}/sso/login`);
      loginUrl.searchParams.set('return_url', request.url);
      loginUrl.searchParams.set('app_name', APP_NAME);
      
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('manaboodle_sso_token');
      response.cookies.delete('manaboodle_sso_refresh');
      return response;
    }
    
    // Token valid, attach user info to headers (accessible in your pages/API routes)
    const { user } = await verifyResponse.json();
    const response = NextResponse.next();
    
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email);
    response.headers.set('x-user-name', user.name || '');
    response.headers.set('x-user-class', user.classCode || '');
    
    return response;
    
  } catch (error) {
    console.error('SSO verification error:', error);
    
    // On error, redirect to login
    const loginUrl = new URL(`${MANABOODLE_SSO_URL}/sso/login`);
    loginUrl.searchParams.set('return_url', request.url);
    loginUrl.searchParams.set('app_name', APP_NAME);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
