import { useState, useRef, useEffect, FormEvent } from 'react';
import { CONCIERGE_SEED, SUGGESTIONS, type ChatMsg } from './shellData';

// Same transport contract as the existing ArosChat: the router is reached at
// ${ROUTER_URL}/v1/chat (proxied server-side when unset), body { agentId,
// messages, stream }, reply in data.response|message|content.
const ROUTER_URL = (import.meta as any).env?.VITE_ROUTER_URL || '';

/**
 * Concierge chat home. Sends to the real shre-router /v1/chat and renders the
 * reply; falls back to a friendly error bubble on failure (e.g. no router in
 * the preview). Optimistic user bubble + typing indicator.
 */
export function ConciergeChat({ onConnect }: { onConnect?: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>(CONCIERGE_SEED);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setMessages(prev => [...prev, { from: 'me', text: q }]);
    setDraft('');
    setSending(true);
    try {
      const res = await fetch(`${ROUTER_URL}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'aros-agent', messages: [{ role: 'user', content: q }], stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.response || data.message || data.content || 'No response received.';
      setMessages(prev => [...prev, { from: 'shre', text: reply, meta: 'Shre · Local' }]);
    } catch {
      setMessages(prev => [...prev, { from: 'shre', text: 'I couldn’t reach the store brain just now. Try again in a moment — your stores and data are unaffected.', meta: 'Shre · Local' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="aros-chat">
      <div className="aros-thread">
        {messages.map((m, i) => (
          <div key={i} className={`aros-msg ${m.from === 'me' ? 'aros-msg--me' : ''}`}>
            <div className="aros-msg__av">{m.from === 'me' ? 'DR' : 'S'}</div>
            <div>
              <div className="aros-msg__bubble">{m.text}</div>
              {m.meta && <div className="aros-msg__meta">{m.meta}</div>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="aros-msg">
            <div className="aros-msg__av">S</div>
            <div className="aros-msg__bubble aros-msg__typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="aros-composer">
        <div className="aros-chips">
          <button className="aros-chip" type="button" onClick={onConnect}><span className="aros-chip__dot" />Connect Store</button>
          <button className="aros-chip" type="button"><span className="aros-chip__dot" />Connect Apps</button>
        </div>
        <form className="aros-inputrow" onSubmit={(e: FormEvent) => { e.preventDefault(); send(draft); }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder='Message Shre… try “How were sales yesterday?”'
            aria-label="Message Shre"
            disabled={sending}
          />
          <button className="aros-send" type="submit" aria-label="Send" disabled={sending || !draft.trim()}>↑</button>
        </form>
        <div className="aros-suggest">
          {SUGGESTIONS.map(sg => (
            <button key={sg} type="button" className="aros-suggest__btn" onClick={() => send(sg)} disabled={sending}>{sg}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
