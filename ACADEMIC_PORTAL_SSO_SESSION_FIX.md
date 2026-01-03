# Academic Portal SSO Session Detection - Implementation Guide

## Problem
Currently, `/academic-portal/login` always shows the login form, even when users are already logged into Manaboodle. This creates a poor user experience where users must log in twice when accessing SSO-integrated apps like:
- `ppp.manaboodle.com`
- `clusters.manaboodle.com`

## Required Behavior
The `/academic-portal/login` endpoint should check for an existing authenticated session and automatically complete SSO without showing the login form.

## Implementation Requirements

### Endpoint: `/academic-portal/login`

#### Current Flow (BROKEN):
1. User clicks "Log in with Manaboodle" from external app
2. Redirects to `/academic-portal/login?return_url=<callback>&app_name=<app>`
3. **Always shows login form** (even if already logged in)
4. User logs in
5. Redirects back to app with SSO tokens

#### Expected Flow (FIXED):
1. User clicks "Log in with Manaboodle" from external app
2. Redirects to `/academic-portal/login?return_url=<callback>&app_name=<app>`
3. **Check for existing session:**
   - ✅ **If authenticated**: Immediately redirect to `return_url` with SSO tokens
   - ❌ **If not authenticated**: Show login form
4. (Only if login form shown) User logs in
5. Redirects back to app with SSO tokens

### Technical Implementation

#### Step 1: Add Session Check to `/academic-portal/login` Route

```typescript
// app/academic-portal/login/route.ts or page.tsx (depending on structure)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnUrl = searchParams.get('return_url');
  const appName = searchParams.get('app_name');
  
  // Check if user has an active session
  const session = await getSession(); // Use your existing session management
  
  if (session && session.user) {
    // User is already logged in - generate SSO tokens and redirect immediately
    console.log('[SSO] User already authenticated, auto-completing SSO for:', appName);
    
    const ssoToken = await generateSsoToken(session.user);
    const ssoRefresh = await generateSsoRefreshToken(session.user);
    
    // Build callback URL with tokens
    const callbackUrl = new URL(returnUrl);
    callbackUrl.searchParams.set('sso_token', ssoToken);
    callbackUrl.searchParams.set('sso_refresh', ssoRefresh);
    
    // Immediate redirect - no login form shown
    return NextResponse.redirect(callbackUrl.toString());
  }
  
  // User not logged in - show login form as usual
  console.log('[SSO] No session found, showing login form');
  return NextResponse.next(); // or render login page
}
```

#### Step 2: Ensure Session Cookie is Accessible

The session check relies on reading the existing Manaboodle session cookie. Ensure:

```typescript
// Session cookie should be set on the root domain:
response.cookies.set('manaboodle_session', sessionToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  domain: '.manaboodle.com', // Important: makes cookie accessible across subdomains
  maxAge: 60 * 60 * 24 * 7 // 7 days
});
```

#### Step 3: Verify SSO Token Generation

Ensure your existing SSO token generation functions are available:

```typescript
async function generateSsoToken(user: User): Promise<string> {
  // Your existing implementation
  // Should create a JWT with user data, expires in 7 days
}

async function generateSsoRefreshToken(user: User): Promise<string> {
  // Your existing implementation
  // Should create a refresh token, expires in 30 days
}
```

## Testing Checklist

### Test Case 1: User Already Logged In
1. ✅ Log into Manaboodle Academic Portal directly
2. ✅ Visit `clusters.manaboodle.com` in the same browser
3. ✅ Click "Log in with Manaboodle"
4. ✅ **Expected**: Should redirect back instantly without showing login form
5. ✅ **Result**: User is authenticated on Clusters

### Test Case 2: User Not Logged In
1. ✅ Clear all cookies/use incognito
2. ✅ Visit `clusters.manaboodle.com`
3. ✅ Click "Log in with Manaboodle"
4. ✅ **Expected**: Shows Academic Portal login form
5. ✅ Log in with credentials
6. ✅ **Result**: Redirected back to Clusters, authenticated

### Test Case 3: Multiple Apps (PPP)
1. ✅ Log into Manaboodle Academic Portal
2. ✅ Visit `ppp.manaboodle.com`
3. ✅ Click "Log in with Manaboodle"
4. ✅ **Expected**: Instant authentication, no login form
5. ✅ **Result**: User authenticated on PPP

### Test Case 4: Session Expiry
1. ✅ Log into Manaboodle
2. ✅ Wait for session to expire (or manually delete session)
3. ✅ Visit `clusters.manaboodle.com`
4. ✅ **Expected**: Shows login form (expired session detected)

## Affected Applications

Once this fix is deployed, the following apps will benefit from seamless SSO:

- ✅ **ppp.manaboodle.com** - PPP Reality Dashboard
- ✅ **clusters.manaboodle.com** - Clusters Application
- ✅ Any future SSO-integrated Manaboodle apps

## Security Considerations

1. **Session validation**: Always verify session is valid and not expired before auto-completing SSO
2. **Token security**: SSO tokens should be short-lived (7 days) with refresh capability (30 days)
3. **HTTPS only**: All SSO flows must use HTTPS in production
4. **CSRF protection**: Ensure return_url is validated against allowed domains

## Implementation Priority

**HIGH PRIORITY** - This directly impacts user experience across all SSO-integrated Manaboodle applications.

## Deployment Notes

- This is a **server-side only change** to Manaboodle Academic Portal
- No changes needed on `ppp.manaboodle.com` or `clusters.manaboodle.com`
- After deployment, test with both apps to confirm seamless SSO

## Questions?

- How does your current session management work?
- Where are SSO token generation functions located?
- What is the session cookie name and domain configuration?

---

**Drop this file into the Manaboodle repository and tell Copilot:**

"Implement the session detection logic described in ACADEMIC_PORTAL_SSO_SESSION_FIX.md for the /academic-portal/login endpoint. This should check for existing sessions and auto-complete SSO without showing the login form when users are already authenticated."
