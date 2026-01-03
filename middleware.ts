// middleware.ts
// Manaboodle SSO Integration - DO NOT MODIFY VERIFICATION LOGIC

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// CONFIGURATION
// ============================================
const MANABOODLE_BASE_URL = 'https://www.manaboodle.com';
const MANABOODLE_LOGIN_URL = 'https://www.manaboodle.com/academic-portal/login';
const APP_NAME = 'Clusters';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/sso-callback',
  '/api/health',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('manaboodle_sso_token')?.value;
  const ssoToken = request.nextUrl.searchParams.get('sso_token');
  
  console.log('[CLUSTERS MIDDLEWARE] Request:', {
    pathname,
    hasToken: !!token,
    hasSsoTokenParam: !!ssoToken
  });
  
  // Handle SSO callback FIRST (when returning from Manaboodle login)
  if (ssoToken) {
    console.log('[CLUSTERS MIDDLEWARE] SSO callback detected');
    
    const redirectPath = '/';
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    
    // Store SSO token in httpOnly cookie
    response.cookies.set('manaboodle_sso_token', ssoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    const refreshToken = request.nextUrl.searchParams.get('sso_refresh');
    if (refreshToken) {
      response.cookies.set('manaboodle_sso_refresh', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }
    
    console.log('[CLUSTERS MIDDLEWARE] SSO callback complete, redirecting to home');
    return response;
  }
  
  // Allow public paths
  const isPublicPath = PUBLIC_PATHS.some(path => {
    return pathname === path || pathname.startsWith(path);
  });
  
  if (isPublicPath) {
    // For public paths, if token exists, verify it and inject user headers
    if (token) {
      try {
        const verifyResponse = await fetch(`${MANABOODLE_BASE_URL}/api/sso/verify`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          },
          cache: 'no-store'
        });
        
        if (verifyResponse.ok) {
          const responseData = await verifyResponse.json();
          const user = responseData.user || responseData;
          
          if (user && user.id && user.email) {
            console.log('[CLUSTERS MIDDLEWARE] User verified:', user.email);
            const response = NextResponse.next();
            
            response.headers.set('x-user-id', user.id);
            response.headers.set('x-user-email', user.email);
            response.headers.set('x-user-name', user.name || '');
            response.headers.set('x-user-class', user.classCode || '');
            
            return response;
          }
        } else {
          // Invalid token, clear it
          const response = NextResponse.next();
          response.cookies.delete('manaboodle_sso_token');
          response.cookies.delete('manaboodle_sso_refresh');
          return response;
        }
      } catch (error) {
        console.error('[CLUSTERS MIDDLEWARE] Error verifying token:', error);
      }
    }
    
    // No token or verification failed on public path, just continue
    return NextResponse.next();
  }
  
  // For all other paths, require authentication
  if (!token) {
    console.log('[CLUSTERS MIDDLEWARE] No token, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify token and inject user headers
  try {
    const verifyResponse = await fetch(`${MANABOODLE_BASE_URL}/api/sso/verify`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (verifyResponse.ok) {
      const responseData = await verifyResponse.json();
      const user = responseData.user || responseData;
      
      if (user && user.id && user.email) {
        console.log('[CLUSTERS MIDDLEWARE] User authenticated:', user.email);
        const response = NextResponse.next();
        
        response.headers.set('x-user-id', user.id);
        response.headers.set('x-user-email', user.email);
        response.headers.set('x-user-name', user.name || '');
        response.headers.set('x-user-class', user.classCode || '');
        
        return response;
      }
    }
    
    // Invalid token, redirect to login
    console.log('[CLUSTERS MIDDLEWARE] Invalid token, redirecting to login');
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('manaboodle_sso_token');
    response.cookies.delete('manaboodle_sso_refresh');
    return response;
  } catch (error) {
    console.error('[CLUSTERS MIDDLEWARE] Error verifying token:', error);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect_to', pathname);
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
