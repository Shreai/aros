/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoice } from './voice';

// --- controllable fake Web Speech API ---------------------------------------
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: any = null;
  onerror: any = null;
  onend: any = null;
  started = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { this.started = false; this.onend?.(); }
  abort() { this.started = false; }
  emit(segments: { transcript: string; isFinal: boolean }[]) {
    const results: any = segments.map((s) => { const arr: any = [{ transcript: s.transcript }]; arr.isFinal = s.isFinal; return arr; });
    results.length = segments.length;
    this.onresult?.({ resultIndex: 0, results });
  }
  static latest() { return FakeRecognition.instances[FakeRecognition.instances.length - 1]; }
}

let utterances: any[] = [];
class FakeUtterance {
  text: string;
  lang = '';
  onend: any = null;
  onerror: any = null;
  constructor(t: string) { this.text = t; utterances.push(this); }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  utterances = [];
  (globalThis as any).SpeechRecognition = FakeRecognition;
  (globalThis as any).webkitSpeechRecognition = FakeRecognition;
  (window as any).SpeechRecognition = FakeRecognition;
  (window as any).webkitSpeechRecognition = FakeRecognition;
  (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
  (window as any).SpeechSynthesisUtterance = FakeUtterance;
  (window as any).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
});

function setup(handsFree: boolean, onSendImpl?: (t: string) => boolean | void) {
  const state = { input: '', sends: [] as string[] };
  const props = {
    handsFree,
    getInput: () => state.input,
    setInput: (v: string) => { state.input = v; },
    onSend: (t: string) => { state.sends.push(t); return onSendImpl ? onSendImpl(t) : undefined; },
  };
  const view = renderHook((p: any) => useVoice(p), { initialProps: props });
  return { ...view, state };
}

describe('useVoice coordination', () => {
  it('dictation: interim paints, final accumulates, nothing is sent', () => {
    const { result, state } = setup(false);
    act(() => { result.current.toggleMic(); });
    const r = FakeRecognition.latest();
    act(() => { r.emit([{ transcript: 'show me', isFinal: false }]); });
    expect(state.input).toBe('show me');
    act(() => { r.emit([{ transcript: 'show me sales', isFinal: true }]); });
    expect(state.input).toBe('show me sales');
    expect(state.sends).toEqual([]);
    expect(result.current.listening).toBe(true);
  });

  it('hands-free: a final utterance auto-sends and clears the composer', () => {
    const { result, state } = setup(true);
    act(() => { result.current.toggleMic(); });
    act(() => { FakeRecognition.latest().emit([{ transcript: 'reorder milk', isFinal: true }]); });
    expect(state.sends).toEqual(['reorder milk']);
    expect(state.input).toBe('');
  });

  it('dropped-utterance fix: when onSend rejects (busy), the utterance is kept, not lost', () => {
    const { result, state } = setup(true, () => false); // always "busy"
    act(() => { result.current.toggleMic(); });
    act(() => { FakeRecognition.latest().emit([{ transcript: 'check inventory', isFinal: true }]); });
    expect(state.sends).toEqual(['check inventory']);
    expect(state.input).toBe('check inventory'); // kept in the composer
  });

  it('feedback-loop fix: while the reply is spoken, recognition is paused so the reply is not re-sent', () => {
    const { result, state } = setup(true);
    act(() => { result.current.toggleMic(); });
    const r1 = FakeRecognition.latest();
    // assistant reply is spoken (mic should pause for its duration)
    act(() => { result.current.speak('Your sales are up 12 percent'); });
    // the recognizer that was live now hearing the spoken reply must NOT produce a send
    act(() => { r1.emit([{ transcript: 'your sales are up 12 percent', isFinal: true }]); });
    expect(state.sends).toEqual([]); // no self-transcription send
    // speech finishes -> recognition resumes on a fresh recognizer
    const u = utterances[utterances.length - 1];
    act(() => { u.onend?.(); });
    const r2 = FakeRecognition.latest();
    expect(r2).not.toBe(r1);
    act(() => { r2.emit([{ transcript: 'what about margins', isFinal: true }]); });
    expect(state.sends).toEqual(['what about margins']); // real user speech after the reply sends
  });

  it('stale results after stop() are ignored (no late send / composer write)', () => {
    const { result, state } = setup(true);
    act(() => { result.current.toggleMic(); });
    const r = FakeRecognition.latest();
    act(() => { result.current.stop(); });
    act(() => { r.emit([{ transcript: 'ghost utterance', isFinal: true }]); });
    expect(state.sends).toEqual([]);
    expect(state.input).toBe('');
    expect(result.current.listening).toBe(false);
  });
});
