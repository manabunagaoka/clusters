'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from './store/useAppStore';
import { useEffect, useState } from 'react';
import {
  FileText, Bug, Component as ComponentIcon,
  Sparkles, MailPlus, User, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Item = { href:string; label:string; icon: LucideIcon };

const items: Item[] = [
  { href:'/instructions', label:'Instructions', icon: FileText },
  { href:'/problem', label:'Problem Statement', icon: Bug },
  { href:'/interview', label:'Interview', icon: Users },
  { href:'/clusters', label:'Clusters', icon: ComponentIcon },
  { href:'/insights', label:'Insights', icon: Sparkles },
  { href:'/subscribe', label:'Subscribe', icon: MailPlus },
];

export default function ClustersLayout({ children }:{ children:React.ReactNode }) {
  const p = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Removed dev auto-reset to preserve user-entered PS wizard state across navigation

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { if (isMobile) setDrawerOpen(false); }, [p, isMobile]);

  const isOpen = isMobile ? drawerOpen : !collapsed;
  const psReady = useAppStore((s:any)=> s.psReady);
  const interviewReady = useAppStore((s:any)=> s.interviewReady);
  const interviewMatrix = useAppStore((s:any)=> s.interviewMatrix);
  const profilesMatrix = useAppStore((s:any)=> s.profilesMatrix);
  const profiles = useAppStore((s:any)=> s.profiles);
  const psSnapshot = useAppStore((s:any)=> s.psSnapshot);

  // Rehydrate gating flags if underlying data already exists (e.g., after accidental reload in dev)
  useEffect(()=>{
    const st = useAppStore.getState() as any;
    if(!st.psReady && Array.isArray(psSnapshot?.themes) && psSnapshot.themes.length>0){
      useAppStore.setState({ psReady:true });
    }
    const hasInterviewData = (Array.isArray(st.themesMatrix) && st.themesMatrix.length>0) || (Array.isArray(st.profilesMatrix)&& st.profilesMatrix.length>0) || (Array.isArray(st.profiles)&& st.profiles.length>0) || (Array.isArray(st.interviewMatrix)&& st.interviewMatrix.length>0);
    if(!st.interviewReady && hasInterviewData){
      useAppStore.setState({ interviewReady:true });
    }
  }, [psSnapshot, interviewMatrix, profilesMatrix, profiles]);
  const interviewEnabled = !!psReady;
  const clustersEnabled = !!interviewReady || Boolean(
    (Array.isArray(interviewMatrix) && interviewMatrix.length>0) ||
    (Array.isArray(profilesMatrix) && profilesMatrix.length>0) ||
    (Array.isArray(profiles) && profiles.length>0)
  );

  return (
    <div className="app-root">
      {/* Full-width header with chevron toggle next to brand */}
      <header className="topbar">
        <button
          className="header-toggle"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => (isMobile ? setDrawerOpen(v => !v) : setCollapsed(c => !c))}
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? <ChevronLeft className="nav-icon" /> : <ChevronRight className="nav-icon" />}
        </button>
        <div className="topbar-title" style={{ marginLeft: 8 }}>
          <span className="brand-green">Clusters</span>
          <span className="subtitle">JTBD Student Edition (MVP)</span>
        </div>
      </header>

      <div className="app-shell">
        {/* Sidebar with tabs at the very top (no divider) */}
        <aside className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile && drawerOpen ? 'open' : ''}`}>
          <nav className="nav">
            {items.map(({ href, label, icon:Icon }) => {
              const active = p === href;
              const gated = (href === '/clusters' && !clustersEnabled) || (href === '/interview' && !interviewEnabled);
              const className = `nav-link ${active ? 'active' : ''} ${gated ? 'disabled' : ''}`;
              if (gated) {
                return (
                  <div
                    key={href}
                    className={className}
                    title={href === '/interview' ? 'Add PS themes (Generate + Extract Themes) first' : 'Run Interview -> Extract Themes first'}
                    aria-disabled="true"
                    style={{cursor:'not-allowed', opacity:0.5}}
                  >
                    <Icon className="nav-icon" />
                    <span className="nav-label">{label}</span>
                  </div>
                );
              }
              return (
                <Link key={href} className={className} href={href} title={label}>
                  <Icon className="nav-icon" />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer and bottom account row */}
          <div style={{ flex: 1 }} />
          <div className="section-sep" />
          <div className="sidebar-footer">
            <Link href="/account" className="plain-row account-row account-link" title="Account">
              <User className="nav-icon" />
              <span className="nav-label">Account</span>
            </Link>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isMobile && drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}

        {/* Main content */}
        <div className="content">
          <main className="main">{children}</main>
        </div>
      </div>
    </div>
  );
}