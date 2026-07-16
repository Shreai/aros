import { useState, useEffect, useRef } from 'react';
import { useArosTheme } from '../lib/useArosTheme';
import { ConciergeChat } from './ConciergeChat';
import { SectionPanel } from './SectionPanel';
import { ConnectWizard } from './ConnectWizard';
import { Canvas } from './Canvas';
import { Home } from './Home';
import { branding } from './branding';
import {
  PRIMARY_NAV, WORKSPACE_NAV, USER, ROLES, SECTION_TITLES, type SectionKey, type NavItem,
} from './shellData';

const CHAT_MODELS = ['Shre · Local', 'Anthropic Claude', 'OpenAI GPT-4o', 'Google Gemini'];

const ChatIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
const MenuIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>);
const PlusIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);

function NavRow({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button className="rsx-nav" aria-current={active} onClick={onClick}>
      <span className="rsx-nav__glyph">{item.glyph}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count != null && <span className="rsx-nav__count">{item.count}</span>}
    </button>
  );
}

function UserRow({ onClick }: { onClick: () => void }) {
  return (
    <button className="rsx2-userrow" onClick={onClick}>
      <span className="aros-user__avatar">{USER.initials}</span>
      <span className="rsx2-userrow__info">
        <span className="aros-user__name">{USER.name}</span>
        <span className="aros-user__meta">{USER.role} · {USER.workspace}</span>
      </span>
    </button>
  );
}

export function AppShell() {
  const b = branding();
  const [mode, setMode] = useState<'home' | 'chat' | 'app'>('home');
  const [section, setSection] = useState<Exclude<SectionKey, 'chat'>>('stores');
  const [role, setRole] = useState<string>(USER.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(CHAT_MODELS[0]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [seed, setSeed] = useState('');
  const { label: themeLabel, toggle: toggleTheme } = useArosTheme();
  const chatToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const openWizard = () => setWizardOpen(true);
  const askShre = (q?: string) => { setSeed(q || ''); setMode('chat'); };
  const toggleChat = () => setMode(m => (m === 'chat' ? 'home' : 'chat'));
  const goSection = (key: SectionKey) => {
    setMenuOpen(false); setProfileOpen(false);
    if (key === 'chat') { setMode('chat'); return; }
    setSection(key); setMode('app');
  };
  const title = mode === 'chat' ? 'Concierge' : mode === 'home' ? 'Home' : SECTION_TITLES[section];

  return (
    <div className="rsx2-shell" data-chat={mode === 'chat' ? 'open' : 'closed'} data-mode={mode}>
      <header className="rsx2-top">
        <button ref={chatToggleRef} className={`rsx2-icon ${mode === 'chat' ? 'is-on' : ''}`} onClick={toggleChat} aria-label="Chat" aria-expanded={mode === 'chat'} title="Chat"><ChatIcon /></button>
        <div className="rsx2-top__menu">
          <button className={`rsx2-icon ${menuOpen ? 'is-on' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu" title="Menu"><MenuIcon /></button>
          {menuOpen && (
            <>
              <div className="rsx2-menuscrim" onClick={() => setMenuOpen(false)} />
              <div className="rsx2-dropdown">
                <button className="rsx2-dropdown__item" onClick={() => goSection('chat')}><span className="rsx-nav__glyph">C</span>Chat</button>
                {PRIMARY_NAV.filter(i => i.key !== 'chat').map(item => (
                  <button key={item.key} className="rsx2-dropdown__item" onClick={() => goSection(item.key)}>
                    <span className="rsx-nav__glyph">{item.glyph}</span>{item.label}
                    {item.count != null && <span className="rsx-nav__count" style={{ marginLeft: 'auto' }}>{item.count}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="rsx2-brand" onClick={() => setMode('home')} title="Home">
          <span className="aros-side__mark">{b.mark}</span><span className="rsx2-top__title">{title}</span>
        </button>
        {mode === 'chat' && <span className="aros-topbar__pill">{b.concierge} · Local</span>}
        <div style={{ flex: 1 }} />
        <span className="aros-topbar__status rsx2-hide-sm"><span className="aros-health__dot" style={{ background: 'var(--ok)' }} /> 5 stores live</span>
        <button className="aros-topbar__toggle rsx2-hide-sm" onClick={toggleTheme}>{themeLabel}</button>
        <button className="rsx2-avatar" onClick={() => setProfileOpen(true)} aria-label="Profile" title="Profile">{USER.initials}</button>
      </header>

      {mode === 'app' ? (
        <div className="rsx2-appbody">
          <aside className="rsx2-nav">
            <div className="rsx2-nav__list">
              <NavRow item={{ key: 'chat', label: 'Chat', glyph: 'C' }} active={false} onClick={() => setMode('chat')} />
              {PRIMARY_NAV.filter(i => i.key !== 'chat').map(item => (
                <NavRow key={item.key} item={item} active={section === item.key} onClick={() => goSection(item.key)} />
              ))}
            </div>
            <div className="rsx2-nav__foot"><UserRow onClick={() => setProfileOpen(true)} /></div>
          </aside>
          <div className="rsx2-content"><SectionPanel section={section} onConnect={openWizard} /></div>
        </div>
      ) : (
        <div className="rsx2-slide">
          <div className="rsx2-rail">
            <div className="rsx2-rail__inner" aria-hidden={mode !== 'chat'}>
              <div className="rsx2-chatpane__head">
                <div className="rsx2-model">
                  <button className="rsx2-model__btn" onClick={() => setModelOpen(o => !o)}>{model} <span aria-hidden>▾</span></button>
                  {modelOpen && (
                    <>
                      <div className="rsx2-menuscrim" onClick={() => setModelOpen(false)} />
                      <div className="rsx2-dropdown" style={{ top: 'calc(100% + 4px)' }}>
                        {CHAT_MODELS.map(m => (
                          <button key={m} className="rsx2-dropdown__item" onClick={() => { setModel(m); setModelOpen(false); }}>{m}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button className="rsx2-chatpane__new" onClick={() => { setChatKey(k => k + 1); setSeed(''); }}><PlusIcon /> New chat</button>
              </div>
              <ConciergeChat key={chatKey} onConnect={openWizard} seed={seed} focusOnMount={mode === 'chat'} />
            </div>
          </div>
          <div className="rsx2-stage">
            <div className="rsx2-layer rsx2-layer--home" aria-hidden={mode === 'chat'}>
              <Home onAskShre={askShre} onConnect={openWizard} onSection={goSection} />
            </div>
            <div className="rsx2-layer rsx2-layer--canvas" aria-hidden={mode !== 'chat'}>
              <Canvas />
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="rsx2-scrim" onClick={() => setProfileOpen(false)}>
          <aside className="rsx2-profile" onClick={e => e.stopPropagation()}>
            <div className="rsx2-profile__head">
              <div className="aros-user__avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{USER.initials}</div>
              <div>
                <div className="aros-user__name" style={{ fontSize: 15 }}>{USER.name}</div>
                <div className="aros-user__meta">{role} · {USER.workspace}</div>
              </div>
              <button className="rsx-modal__x" style={{ marginLeft: 'auto' }} onClick={() => setProfileOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="aros-role__label" style={{ marginTop: 8 }}>Role</div>
            <div className="aros-role__pills">
              {ROLES.map(r => (<button key={r} className="aros-role__pill" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>))}
            </div>
            <div className="aros-side__section" style={{ marginLeft: 0 }}>Workspace</div>
            <nav>
              {WORKSPACE_NAV.map(item => (
                <NavRow key={item.key} item={item} active={mode === 'app' && section === item.key} onClick={() => goSection(item.key)} />
              ))}
            </nav>
            <div style={{ flex: 1 }} />
            <button className="aros-topbar__toggle rsx2-show-sm" onClick={toggleTheme} style={{ width: '100%', marginBottom: 8 }}>{themeLabel} mode</button>
            <button className="rsx2-signout">Sign out</button>
          </aside>
        </div>
      )}

      {wizardOpen && (
        <ConnectWizard onClose={() => setWizardOpen(false)} onDone={name => { setWizardOpen(false); setToast(`${name} connected — discovering stores…`); }} />
      )}
      {toast && <div className="rsx-toast">✓ {toast}</div>}
    </div>
  );
}
