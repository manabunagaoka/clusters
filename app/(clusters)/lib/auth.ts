// lib/auth.ts
// Utility for accessing authenticated user data from Manaboodle SSO

import { headers } from 'next/headers';

export interface ManaboodleUser {
  id: string;
  email: string;
  name: string;
  classCode: string;
}

/**
 * Get the authenticated user from request headers.
 * This data is injected by the middleware after SSO verification.
 * 
 * Usage in Server Components:
 * ```tsx
 * import { getUser } from './lib/auth';
 * 
 * export default async function MyPage() {
 *   const user = await getUser();
 *   return <h1>Welcome, {user?.name}!</h1>;
 * }
 * ```
 * 
 * Usage in API Routes:
 * ```tsx
 * import { getUser } from '@/lib/auth';
 * 
 * export async function GET() {
 *   const user = await getUser();
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... your logic
 * }
 * ```
 */
export async function getUser(): Promise<ManaboodleUser | null> {
  const headersList = await headers();
  
  const id = headersList.get('x-user-id');
  const email = headersList.get('x-user-email');
  const name = headersList.get('x-user-name');
  const classCode = headersList.get('x-user-class');
  
  if (!id || !email) {
    return null;
  }
  
  return {
    id,
    email,
    name: name || '',
    classCode: classCode || ''
  };
}
