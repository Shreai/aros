# Journey: Store owner talks to the assistant by voice
Persona: Ramesh (see README.md)
Trigger: His hands are busy (stocking a shelf, at the register) but a question
comes up — he'd rather speak than type on a phone.
Entry point: The chat surface — the concierge panel (FAB → slide-in) on the
storefront/app, same composer as the typed journey.

## Golden path (budget: 1 step / speak → hear/see the answer)
| # | User sees/hears | Must already know | The ONE action they take |
|---|-----------------|-------------------|--------------------------|
| 1 | A microphone button in the composer (only when the browser supports it) | *nothing* | Taps the mic and speaks |
| 2 | His words appear in the composer as he speaks; on stop, he taps Send (or in voice-conversation mode it sends automatically) | *nothing* | Taps Send / says it hands-free |
| 3 | The answer with his real data; in voice-conversation mode it is also **read aloud** | *nothing* | (Goal reached — asks a follow-up) |

## Modes
- **Dictation** (mic button): fills the composer; the user reviews and sends. Enter/Send behave identically to typing.
- **Voice conversation** (speaker button): hands-free — each spoken utterance auto-sends and the reply is spoken back. Barge-in: starting the mic cancels any in-progress speech.

## Failure states
| Step | What goes wrong | What the screen says/does | Self-service recovery |
|------|-----------------|--------------------------|-----------------------|
| 1 | Browser has no Web Speech API (e.g. some in-app webviews) | The mic/speaker buttons **do not render** — typed chat is unaffected | Type as normal |
| 1 | Microphone permission denied | Listening stops silently; the mic button returns to idle | Grant mic permission in the browser and tap again |
| 2 | Nothing recognized / silence | Composer stays empty; no send fires | Tap mic again and speak |
| 3 | Reply fails (same as typed path) | Honest error bubble, **never a fabricated answer**; nothing is spoken | Retry |

## Invariants
- Voice is an input method over the **existing** send path — it never bypasses
  the real `/v1/chat` call, so answers are as honest as the typed journey.
- Speech is capped and markdown-stripped; the assistant never reads code blocks
  or URLs aloud.
- Leaving voice-conversation mode or closing the panel silences any speech and
  stops the mic.

## Validation (this change)
- Pure transcript-composition logic unit-tested (`apps/web/src/aros-ai/voice.test.ts`):
  dictation accumulation, hands-free auto-send, interim painting, empty-input.
- `speak()` markdown-stripping unit-tested.
- Typecheck + production build green.
- NEEDS-BROWSER (deferred to a live walk): real microphone capture and
  speech-synthesis output require device permission/hardware and cannot run in
  the seam-level harness — verify on the deployed surface with a real mic.
