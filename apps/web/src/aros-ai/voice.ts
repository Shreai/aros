/* eslint-disable @typescript-eslint/no-explicit-any */
// Voice for the AROS concierge: browser Web Speech dictation into the same send path as typing,
// optional hands-free (each final utterance auto-sends), and speak-replies TTS. Gracefully inert
// where the Web Speech API is unavailable (supported === false), and a no-op on the server.
import { useCallback, useEffect, useRef, useState } from 'react';

function getSR(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** Speak assistant text, stripped of markdown noise and capped so long answers don't ramble. */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  const clean = text
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = navigator.language || 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export interface Composed {
  /** what the composer should now display */
  value: string;
  /** a line to auto-send (hands-free finals), or null */
  send: string | null;
  /** carry-over base for the next recognition event */
  nextBase: string;
}

/**
 * Pure transcript composition (unit-tested). Given the running base text and the recognition
 * results, decide what the composer shows, what (if anything) to auto-send, and the next base.
 * Non-hands-free finals accumulate into the base; hands-free finals become a send and reset it.
 */
export function composeFromResults(
  base: string,
  results: { transcript: string; isFinal: boolean }[],
  handsFree: boolean,
): Composed {
  let b = base;
  let interim = '';
  let send: string | null = null;
  for (const res of results) {
    const text = (res.transcript || '').trim();
    if (!text) continue;
    if (res.isFinal) {
      if (handsFree) { send = (b + text).trim(); b = ''; }
      else b += text + ' ';
    } else {
      interim += text + ' ';
    }
  }
  return { value: (b + interim).replace(/\s+$/, ''), send, nextBase: b };
}

export interface VoiceApi {
  supported: boolean;
  listening: boolean;
  toggleMic: () => void;
  stop: () => void;
}

/**
 * Dictation hook. `handsFree` (a live prop) makes each final utterance auto-send via `onSend`
 * instead of accumulating in the composer; otherwise finals stay in the input for review.
 */
export function useVoice(opts: {
  handsFree: boolean;
  getInput: () => string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
}): VoiceApi {
  const supported = !!getSR();
  const [listening, setListening] = useState(false);

  const recRef = useRef<any>(null);
  const baseRef = useRef('');
  const listeningRef = useRef(false);
  const handsFreeRef = useRef(opts.handsFree);
  const getInputRef = useRef(opts.getInput);
  const onSendRef = useRef(opts.onSend);
  const setInputRef = useRef(opts.setInput);
  useEffect(() => {
    handsFreeRef.current = opts.handsFree;
    getInputRef.current = opts.getInput;
    onSendRef.current = opts.onSend;
    setInputRef.current = opts.setInput;
  });

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    cancelSpeech(); // barge-in: don't talk over the user
    const cur = getInputRef.current().trim();
    baseRef.current = cur ? cur + ' ' : '';
    const r = new SR();
    recRef.current = r;
    listeningRef.current = true;
    setListening(true);
    r.continuous = true;
    r.interimResults = true;
    r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    r.onresult = (ev: any) => {
      const results: { transcript: string; isFinal: boolean }[] = [];
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        results.push({ transcript: ev.results[i][0]?.transcript || '', isFinal: !!ev.results[i].isFinal });
      }
      const { value, send, nextBase } = composeFromResults(baseRef.current, results, handsFreeRef.current);
      baseRef.current = nextBase;
      if (send) { setInputRef.current(''); onSendRef.current(send); }
      else setInputRef.current(value);
    };
    r.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') stop();
    };
    r.onend = () => {
      // the API stops itself after silence; keep listening until toggled off
      if (listeningRef.current && recRef.current === r) {
        setTimeout(() => { try { r.start(); } catch {} }, 300);
      }
    };
    try { r.start(); } catch {}
  }, [stop]);

  const toggleMic = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]); // stop on unmount
  return { supported, listening, toggleMic, stop };
}
