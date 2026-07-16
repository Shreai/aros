# AROS Platform Changelog

All notable changes to AROS Platform are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Planned / In Progress
- Flip the chat-first redesign to default (pending live verification + security pre-flip checks: server-side tenant-id authz, `Cache-Control: private, no-store`, demo-leak checks)
- Converge the redesign canvas onto the shared `mib-widget` content-block contract (once the live fork picks up PR #38)
- Restyle the Login/Signup auth screens to the new theme
- MIB API reuse for resources/POS (blocked on a shre-id tenant↔company token bridge)
- Shre brain sync integration; BYOM model selector; Licensing module

## [0.5.0] — 2026-07-16 — Chat-first redesign (soft launch)
### Added
- Chat-first "Command Home" redesign — warm Stripe/Apple theme (light/dark), gated behind `?redesign=1` (OFF by default; old dashboard unchanged).
- Home ⇄ chat slide; conversation canvas with Canvas/History tabs; 4-step Connect-a-register wizard (RapidRMS + Verifone).
- Left-panel profile (role + workspace nav), whitelabel branding module, responsive (mobile/tablet), consistent docked sidebar.
- Live data wiring: `/api/connectors`, `/api/resources/*`, `/api/dashboard`, `/api/store/summary`, `/api/billing/status`. Demo persona/figures render ONLY when unauthenticated (`/preview/app`) — never in a live session.
### Notes
- Deployed to production behind the flag on 2026-07-16 (default experience unchanged). Reconciled onto the hand-managed VPS live fork (`live/direct-deploy`), not a main-based build. Rollback: `?redesign=0` or restore `apps/web/dist.prev` + `pm2 reload`.

## [0.4.0] — 2026-03-25
### Added
- Health server, web app, security hardening, RBAC, ArosChat redesign.

## [0.3.1] — 2026-03-18
### Added
- Plugin & connector developer guide, DATA_PLUGIN_GUIDE, first-party app catalog.

## [0.3.0] — 2026-03-18
### Added
- RapidRMS connector, AWS RDS connector, Conexxus local store, third-party plugin docs, marketplace database nodes.

## [0.2.0] — 2026-03-18
### Added
- Public release: BSL license, BYOM enforcement, AI Models settings UI, rapidrms-ops submodule.

## [0.1.0] — 2026-03-18
### Added
- Initial AROS Platform scaffold
- Whitelabel system (theme, logo, agent name, full UI customization)
- AROS AI agent (platform driver — soul, tools, LLM provider)
- Shre auth plugin (ShreProvider + ArosProvider fallback)
- Marketplace registry (fetch + install nodes from MIB007)
- Updater (core + UI update channels, policy engine, history tracking)
- Versioning system (semver utilities, manifest parsing, two-channel updates)
- Licensing module (free/business/OEM tiers, user limits, BYOM)
- Agent Data Protocol (ADP) — Shre-facing brain API
- Shre control socket (WebSocket directives + events)
- Deploy configs (Docker Compose, Dockerfile, Kubernetes)
- Core: thin wrapper around @mib007/core (version-pinned)
