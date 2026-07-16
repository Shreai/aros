import { USER } from './shellData';

// Home — the calm retail "command home" shown when chat is closed. Presentational;
// wired build fills these from live store data + the approvals queue.

const APPROVALS = [
  { icon: '🏷️', title: 'Raise carton prices 3% at all stores', by: 'Pricing Agent', when: '12m ago' },
  { icon: '📦', title: 'Reorder Marlboro Gold 100s · Harbor (qty 24)', by: 'Inventory Agent', when: '1h ago' },
];
const ACTIVITY = [
  { icon: '📊', text: 'Pushed the morning sales digest — 5 stores, up 4.2% w/w.', when: '8:02 AM' },
  { icon: '🔎', text: 'Flagged 4 SKUs below reorder point across 3 stores.', when: '8:01 AM' },
  { icon: '✅', text: 'RapidRMS sync completed — 1,204 transactions imported.', when: '7:45 AM' },
];

export function Home({ onAskShre, onConnect, onSection }: {
  onAskShre: (q?: string) => void;
  onConnect: () => void;
  onSection: (k: 'skills' | 'agents' | 'stores') => void;
}) {
  return (
    <div className="rsx2-home">
      <div className="rsx2-home__inner">
        <div className="rsx2-home__greeting">
          <div className="rsx2-home__hi">Good afternoon, {USER.name.split(' ')[0]}.</div>
          <div className="rsx2-home__sub">{USER.workspace} Market · <span style={{ color: 'var(--ok)' }}>5 stores live</span></div>
        </div>

        <button className="rsx2-ask" onClick={() => onAskShre()}>
          <span className="rsx2-ask__mark">S</span>
          <span className="rsx2-ask__text">Ask Shre anything — “How were sales yesterday?”</span>
          <span className="rsx2-ask__cue">↵</span>
        </button>
        <div className="rsx2-home__chips">
          {['How were sales yesterday?', 'Which SKUs are low?', 'Raise carton prices 3%'].map(q => (
            <button key={q} className="aros-suggest__btn" onClick={() => onAskShre(q)}>{q}</button>
          ))}
        </div>

        <div className="rsx2-home__kpis">
          <HomeKpi value="$18,240" label="Sales today" delta="+4.2%" up />
          <HomeKpi value="1,204" label="Transactions" delta="+1.8%" up />
          <HomeKpi value="4" label="Low-stock SKUs" delta="needs reorder" />
          <HomeKpi value="2·1·1" label="Health (ok·deg·down)" delta="1 needs attention" />
        </div>

        <div className="rsx2-home__grid">
          <section className="rsx2-panelcard">
            <div className="rsx2-panelcard__head"><h3>Needs your approval</h3><span className="rsx-nav__count">{APPROVALS.length}</span></div>
            {APPROVALS.map(a => (
              <div key={a.title} className="rsx2-feed">
                <span className="rsx2-feed__icon">{a.icon}</span>
                <div className="rsx2-feed__body">
                  <div className="rsx2-feed__title">{a.title}</div>
                  <div className="rsx2-feed__meta">{a.by} · {a.when}</div>
                </div>
                <div className="rsx2-feed__acts">
                  <button className="rsx2-feed__approve" onClick={() => onAskShre(a.title)}>Review</button>
                </div>
              </div>
            ))}
          </section>

          <section className="rsx2-panelcard">
            <div className="rsx2-panelcard__head"><h3>What Shre did</h3><span className="rsx2-canvas__src">today</span></div>
            {ACTIVITY.map(a => (
              <div key={a.text} className="rsx2-feed">
                <span className="rsx2-feed__icon">{a.icon}</span>
                <div className="rsx2-feed__body">
                  <div className="rsx2-feed__title" style={{ fontWeight: 500 }}>{a.text}</div>
                  <div className="rsx2-feed__meta">{a.when}</div>
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="rsx2-home__actions">
          <QuickAction icon="🛒" label="Connect a register" hint="RapidRMS or Verifone" onClick={onConnect} />
          <QuickAction icon="⚡" label="Browse skills" hint="5 available · 2 active" onClick={() => onSection('skills')} />
          <QuickAction icon="🤖" label="View agents" hint="2 running" onClick={() => onSection('agents')} />
        </div>
      </div>
    </div>
  );
}

function HomeKpi({ value, label, delta, up }: { value: string; label: string; delta: string; up?: boolean }) {
  return (
    <div className="rsx2-kpi">
      <div className="rsx2-kpi__value">{value}</div>
      <div className="rsx2-kpi__label">{label}</div>
      <div className={`rsx2-kpi__delta ${up ? 'is-up' : ''}`}>{delta}</div>
    </div>
  );
}

function QuickAction({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button className="rsx2-quick" onClick={onClick}>
      <span className="rsx2-quick__icon">{icon}</span>
      <span className="rsx2-quick__label">{label}</span>
      <span className="rsx2-quick__hint">{hint}</span>
    </button>
  );
}
