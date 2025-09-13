'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  FileText, Bug, Users as UsersIcon, Component as ComponentIcon,
  Sparkles, MailPlus, User, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';

type Item = { href:string; label:string; icon:LucideIcon; external?:boolean };

const items: Item[] = [
  { href:'/instructions', label:'Instructions', icon: FileText },
  { href:'/problem', label:'Problem Statement', icon: Bug },
  { href:'/archetypes', label:'Archetypes', icon: UsersIcon },
  { href:'/metrics', label:'Quality Metrics & Clusters', icon: ComponentIcon },
  { href:'/insights', label:'Insights', icon: Sparkles },
  { href:'https://www.manaboodle.com/subscribe', label:'Subscribe', icon: MailPlus, external:true },
];

export default function ClustersLayout({ children }:{ children:React.ReactNode }) {
  const p = usePathname();

  // Desktop collapse + Mobile drawer
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { if (isMobile) setDrawerOpen(false); }, [p, isMobile]);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile && drawerOpen ? 'open' : ''}`}>
        {/* First nav item = collapse toggle (desktop only) */}
        {!isMobile && (
          <button
            className="nav-link"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="nav-icon" /> : <ChevronLeft className="nav-icon" />}
            <span className="nav-label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        )}

        {/* Nav items */}
        <nav className="nav">
          {items.map(({ href, label, icon:Icon, external }) => {
            const active = !external && p === href;
            const className = `nav-link ${active ? 'active' : ''}`;
            return external ? (
              <a key={href} className={className} href={href} target="_blank" rel="noopener noreferrer" title={label}>
                <Icon className="nav-icon" />
                <span className="nav-label">{label}</span>
              </a>
            ) : (
              <Link key={href} className={className} href={href} title={label}>
                <Icon className="nav-icon" />
                <span className="nav-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Account only */}
        <div className="sidebar-footer" style={{ marginTop:12 }}>
          <Link href="/account" className="nav-link account-link" title="Account" style={{ flexGrow:0 }}>
            <User className="nav-icon" />
            <span className="nav-label">Account</span>
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Content with full-width header */}
      <div className="content">
        <header className="topbar">
          {isMobile && (
            <button className="nav-link" style={{ padding:'6px 10px' }} aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <Menu className="nav-icon" />
              <span className="nav-label">Menu</span>
            </button>
          )}
          <div className="topbar-title" style={{ marginLeft:isMobile ? 8 : 0 }}>
            <span className="brand-green">Clusters</span>
            <span className="subtitle">JTBD Student Edition (MVP)</span>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}