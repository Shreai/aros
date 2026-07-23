import { describe, it, expect } from 'vitest';
import { EXTERNAL_INTELLIGENCE_REQUEST, shouldInterceptTextOnly } from './chatIntent';

/** The composer's real decision, wired exactly as ConciergeChat wires it. */
const intercepts = (text: string, hasAttachments: boolean, capabilityActive = false) =>
  shouldInterceptTextOnly({
    matched: EXTERNAL_INTELLIGENCE_REQUEST.test(text),
    hasAttachments,
    capabilityActive,
  });

describe('EXTERNAL_INTELLIGENCE_REQUEST', () => {
  it('matches the external-data phrasings the retail fleet cannot answer', () => {
    for (const q of ['what is the weather tomorrow', 'any news on Coke?', 'search the web for it', 'look up online']) {
      expect(EXTERNAL_INTELLIGENCE_REQUEST.test(q)).toBe(true);
    }
  });
  it('leaves ordinary store questions alone', () => {
    expect(EXTERNAL_INTELLIGENCE_REQUEST.test('what were yesterday sales')).toBe(false);
  });
});

describe('shouldInterceptTextOnly', () => {
  it('intercepts a text-only request when the capability is missing', () => {
    expect(intercepts('what is the weather tomorrow', false)).toBe(true);
  });

  it('never intercepts a turn that carries attachments', () => {
    // The regression: an invoice photo captioned with one of these words was
    // answered by the canned routing message and the file was thrown away.
    expect(intercepts('any news on this vendor invoice?', true)).toBe(false);
    expect(intercepts('does this forecast sheet look right?', true)).toBe(false);
    expect(intercepts('what is the temperature rating on this label?', true)).toBe(false);
  });

  it('does not intercept when the capability is active', () => {
    expect(intercepts('what is the weather tomorrow', false, true)).toBe(false);
  });

  it('does not intercept an ordinary store question', () => {
    expect(intercepts('what were yesterday sales', false)).toBe(false);
    expect(intercepts('what were yesterday sales', true)).toBe(false);
  });
});
