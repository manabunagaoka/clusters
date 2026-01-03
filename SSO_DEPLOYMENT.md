# Clusters SSO Integration - Deployment Guide

This guide covers the steps to deploy Clusters with Manaboodle SSO authentication.

## Overview

Clusters now uses **Manaboodle Academic Portal SSO** for authentication. Users must have a Harvard .edu account registered in Manaboodle to access the app.

## Prerequisites

- [ ] User must be registered at `https://www.manaboodle.com/academic-portal/signup`
- [ ] Valid .edu email address
- [ ] Class code (T565, T566, or T595)

## Deployment Steps

### 1. DreamHost DNS Configuration

Set up the subdomain `clusters.manaboodle.com`:

1. Log into DreamHost panel
2. Navigate to **Domains → Manage Domains**
3. Click **DNS** for `manaboodle.com`
4. Add a new **CNAME Record**:
   - **Name**: `clusters`
   - **Value**: `cname.vercel-dns.com`
   - **TTL**: Auto (or 14400)
5. Save changes

### 2. Vercel Domain Configuration

Add the custom domain to Vercel:

1. Go to Vercel project: `clusters-git-main-manabunagaokas-projects.vercel.app`
2. Navigate to **Settings → Domains**
3. Click **Add Domain**
4. Enter: `clusters.manaboodle.com`
5. Vercel will automatically:
   - Verify DNS configuration
   - Provision SSL certificate (via Let's Encrypt)
   - Configure HTTPS redirect

**Note**: DNS propagation may take 5-60 minutes.

### 3. Environment Variables

Add to Vercel environment variables:

1. Go to **Settings → Environment Variables**
2. Add:
   ```
   NEXT_PUBLIC_MANABOODLE_URL=https://www.manaboodle.com
   ```
3. Apply to: **Production, Preview, Development**
4. Save and **redeploy** the application

### 4. Update Academic Portal Link

Update the link in `manaboodle.com` Academic Portal:

**Old URL**: `https://clusters-git-main-manabunagaokas-projects.vercel.app/`

**New URL**: `https://clusters.manaboodle.com/`

**Location to update**: Academic Portal dashboard or navigation menu

### 5. Test the SSO Flow

1. **Start fresh**:
   - Open an incognito/private browser window
   - Navigate to: `https://clusters.manaboodle.com/`

2. **Expected flow**:
   - Step 1: Redirects to `https://www.manaboodle.com/sso/login?return_url=...&app_name=Clusters`
   - Step 2: If not logged in, shows login form
   - Step 3: Enter Harvard .edu credentials
   - Step 4: Redirects back to Clusters with tokens
   - Step 5: Lands on `/instructions` page (logged in)

3. **Verify**:
   - Click **Account** in sidebar
   - Should show your name, email, and class code
   - Options: Home, Back to Portal, Sign Out

## How SSO Works

### Authentication Flow

```
User → Clusters → Middleware checks token
                      ↓
                  No token?
                      ↓
           Redirect to Manaboodle SSO
                      ↓
              User logs in (if needed)
                      ↓
           Manaboodle returns with JWT
                      ↓
            Middleware stores in cookie
                      ↓
         Verifies token on each request
                      ↓
            Allows access to Clusters
```

### Security Features

- **HttpOnly cookies**: Tokens not accessible via JavaScript (XSS protection)
- **Secure flag**: Cookies only sent over HTTPS in production
- **SameSite**: CSRF protection
- **Token expiry**: Access token = 7 days, Refresh token = 30 days
- **Server-side verification**: Every request validated against Manaboodle

### Files Added/Modified

1. **`middleware.ts`** (NEW): Intercepts all requests, validates SSO tokens
2. **`app/(clusters)/lib/auth.ts`** (NEW): Helper to get user data in pages/API routes
3. **`app/(clusters)/account/page.tsx`** (MODIFIED): Shows user info and navigation options
4. **`.env.example`** (NEW): Environment variable template

## Troubleshooting

### Issue: "Missing return_url parameter"

**Cause**: Accessing SSO login directly instead of being redirected

**Solution**: Always access Clusters via normal URL, middleware handles redirect automatically

### Issue: Token verification fails

**Symptoms**: Keeps redirecting to login, can't stay logged in

**Possible causes**:
- Manaboodle API is down
- Token expired
- Environment variable `NEXT_PUBLIC_MANABOODLE_URL` incorrect
- CORS or network issue

**Solution**:
- Check Vercel logs for error details
- Verify environment variable is set correctly
- Clear cookies and try again

### Issue: Can't access Clusters at all

**Cause**: Not registered in Manaboodle Academic Portal

**Solution**: 
1. Go to `https://www.manaboodle.com/academic-portal/signup`
2. Register with Harvard .edu email
3. Enter valid class code
4. Complete signup, then try Clusters again

### Issue: "Not a portal user" error

**Cause**: Account exists in Manaboodle but not in `ManaboodleUser` table

**Solution**: Contact Manaboodle admin to verify account status

## Rollback Plan

If SSO causes issues, you can temporarily revert:

1. **Remove middleware**: Rename `middleware.ts` to `middleware.ts.disabled`
2. **Redeploy** on Vercel
3. **Access via**: Original Vercel URL (no auth required)

**Note**: This is a temporary measure. The long-term solution is to fix SSO, not disable it.

## Monitoring

After deployment, monitor:

1. **Vercel Logs**: Check for authentication errors
2. **User feedback**: Any login issues reported
3. **Manaboodle status**: SSO endpoint uptime

## Next Steps (Optional Enhancements)

1. **Remember me**: Use refresh token to extend sessions
2. **Session timeout warning**: Notify before token expiry
3. **Profile editing**: Link to Academic Portal profile page
4. **Admin features**: Role-based access if needed

## Support

- **SSO Issues**: Contact Manaboodle admin
- **Clusters Issues**: Check Vercel logs, GitHub issues
- **User Questions**: Direct to Academic Portal help resources

---

**Deployment Checklist**:

- [ ] DreamHost CNAME configured for `clusters.manaboodle.com`
- [ ] Vercel domain added and SSL verified
- [ ] Environment variable `NEXT_PUBLIC_MANABOODLE_URL` set
- [ ] Application redeployed with latest code
- [ ] Academic Portal link updated
- [ ] SSO flow tested end-to-end
- [ ] Account page displays user info correctly
- [ ] Sign out redirects to Academic Portal
