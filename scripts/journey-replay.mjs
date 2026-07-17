#!/usr/bin/env node
// Persona replay — walks the golden journeys on a DEPLOYED surface as Ramesh
// (docs/journeys/README.md): phone viewport, reads only what's on screen, no
// API shortcuts. The automated stage of the journey gate (JOURNEY_GATE.md
// "journey replay — earn it last"); non-zero exit blocks whatever invoked it
// (cron alert, deploy checklist, promote pipeline).
//
// Usage:
//   REPLAY_EMAIL=... REPLAY_PASSWORD=... node scripts/journey-replay.mjs --base https://app.aros.live
//   REPLAY_MUTATIONS=1  additionally walks the bogus-credentials failure path
//     (writes a throwaway connector on the test tenant — NOT for unattended
//     runs against anything but a dedicated test workspace).
//
// The account must be a dedicated TEST workspace (unconnected persona). It is
// never created here — provision it once via the real signup.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] || process.env.REPLAY_BASE || 'https://app.aros.live').replace(/\/$/, '');
const EMAIL = process.env.REPLAY_EMAIL || process.env.E2E_EMAIL;
const PASSWORD = process.env.REPLAY_PASSWORD || process.env.E2E_PASSWORD;
const MUTATIONS = process.env.REPLAY_MUTATIONS === '1';

if (!EMAIL || !PASSWORD) {
  console.error('journey-replay: set REPLAY_EMAIL + REPLAY_PASSWORD (dedicated test workspace)');
  process.exit(2);
}

const results = [];
const step = (name, ok, evidence) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name} · ${evidence}`);
};
const visible = (loc, ms = 15000) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

try {
  // J1 — a stranger finds the way in
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  step('J1 landing offers a way in', await visible(page.getByRole('link', { name: /get started|sign up/i }).first()), 'visible signup CTA');

  // J1 — login lands on the value surface
  await page.goto(BASE + '/login');
  await page.locator('#login-email').fill(EMAIL);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  step('J1 login succeeds', true, 'landed ' + new URL(page.url()).pathname);

  // J1 — day-one surface: sample data LABELED, a next-step CTA exists
  if (!new URL(page.url()).pathname.startsWith('/start')) await page.goto(BASE + '/start');
  await page.waitForTimeout(4000);
  const startText = (await page.textContent('body')) || '';
  step('J1 sample data labeled', /sample/i.test(startText), /sample/i.test(startText) ? 'labeled' : 'NO sample label');
  step('J1 next-step CTA present', await visible(page.locator('a[href^="/connect"], a[href^="/onboarding"], button:has-text("Connect"), a:has-text("Set up")').first()), 'setup/connect affordance');
  // Truth check: demo chat must never claim real-tenant numbers unlabeled —
  // the sample banner covering the whole surface satisfies the contract.

  // J2 — /connect explains itself with zero assumed knowledge
  await page.goto(BASE + '/connect');
  step('J2 POS by name', await visible(page.getByRole('button', { name: /RapidRMS POS/ }).first()), 'provider card');
  step('J2 Client ID hint tied to input', await visible(page.locator('#conn-clientId-hint')), ((await page.locator('#conn-clientId-hint').textContent().catch(() => '')) || '').slice(0, 40));
  step('J2 not-sure hint', ((await page.textContent('body')) || '').includes('Not sure which one?'), 'plain-words picker help');

  if (MUTATIONS) {
    // J2/J5 failure path — bogus creds must fail honestly, preserve the draft
    await page.locator('#conn-clientId').fill('REPLAY-BOGUS');
    await page.locator('#conn-email').fill('bogus@example.com');
    await page.locator('#conn-password').fill('wrong-password');
    await page.getByRole('button', { name: /Save & Test/ }).click();
    await page.waitForTimeout(20000);
    const after = (await page.textContent('body')) || '';
    step('J2 bad creds -> visible error', /failed|didn.t accept|check the details|rejected/i.test(after), 'plain-words error');
    step('J2 no false success claim', !/now syncing your data|we found/i.test(after), 'no sync/found claim');
    step('J5 draft preserved', (await page.locator('#conn-clientId').inputValue().catch(() => '')) === 'REPLAY-BOGUS', 'typed input kept');
  }

  // J4 — dashboard is honest for this (unconnected) tenant
  await page.goto(BASE + '/dashboard');
  await page.waitForTimeout(5000);
  const path = new URL(page.url()).pathname;
  if (path.startsWith('/start') || path.startsWith('/onboarding')) {
    step('J4 honestly gated pre-onboarding', true, 'redirected to ' + path);
  } else {
    const dash = (await page.textContent('body')) || '';
    step('J4 honest state', /connect a register|once your stores are connected|syncing/i.test(dash), 'honest copy');
    step('J4 no fabricated demo numbers', !/\$18,240|1,204/.test(dash), 'clean');
  }
} catch (e) {
  step('REPLAY ABORTED', false, String(e && e.message).slice(0, 140));
} finally {
  await browser.close();
}

const fails = results.filter((r) => !r.ok).length;
console.log(`\n[journey-replay] ${BASE} · ${results.length - fails}/${results.length} PASS · ${fails} FAIL${MUTATIONS ? ' · (mutations on)' : ''}`);
process.exit(fails ? 1 : 0);
