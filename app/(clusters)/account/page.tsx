import { getUser, getLogoutUrl } from '../lib/auth';
import Link from 'next/link';
import { User, ExternalLink, Home, LogOut } from 'lucide-react';

export default async function Page() {
  const user = await getUser();
  const manaboodleUrl = process.env.NEXT_PUBLIC_MANABOODLE_URL || 'https://www.manaboodle.com';
  const academicPortalUrl = `${manaboodleUrl}/academic-portal`;
  const logoutUrl = getLogoutUrl(typeof window !== 'undefined' ? window.location.origin : undefined);

  return (
    <section>
      <h2 className="page-title">Account</h2>
      
      {user && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 600
                }}
              >
                {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>
                  {user.name || 'Student'}
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>
                  {user.email}
                </div>
                {user.classCode && (
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                    Class: {user.classCode}
                  </div>
                )}
              </div>
            </div>

            <div className="section-sep" style={{ margin: '16px 0' }} />

            <div style={{ display: 'grid', gap: 8 }}>
              <Link
                href="/instructions"
                className="plain-row account-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background-color 0.2s'
                }}
              >
                <Home size={20} style={{ color: '#059669' }} />
                <span style={{ flex: 1 }}>Home (Instructions)</span>
              </Link>

              <a
                href={academicPortalUrl}
                className="plain-row account-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background-color 0.2s'
                }}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={20} style={{ color: '#059669' }} />
                <span style={{ flex: 1 }}>Back to Academic Portal</span>
              </a>

              <a
                href={logoutUrl}
                className="plain-row account-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  textDecoration: 'none',
                  color: '#dc2626',
                  transition: 'background-color 0.2s'
                }}
              >
                <LogOut size={20} />
                <span style={{ flex: 1 }}>Sign Out</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-body">
            <p style={{ color: '#64748b' }}>
              Please sign in to access your account.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
