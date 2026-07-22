# CI Deploy Queue Note

Status date: 2026-07-22

## Resolved

GitHub Actions scheduling is fixed for `Nirlabinc/aros`.

- Repository Actions were disabled at the repo policy layer:
  `repos/Nirlabinc/aros/actions/permissions` returned `enabled: false`.
- Actions were re-enabled with `allowed_actions: all`.
- A new PR check ran and passed:
  `https://github.com/Nirlabinc/aros/actions/runs/29889018177`.
- A fresh staging deploy ran and passed:
  `https://github.com/Nirlabinc/aros/actions/runs/29889050598`.
- Post-deploy public checks returned HTTP 200 for:
  - `https://beta.aros.live`
  - `https://dev.aros.live`

## Stale Runs

Two older manual deploy workflow runs remain stuck in GitHub Actions `queued`
state with no jobs created:

- `https://github.com/Nirlabinc/aros/actions/runs/29859156916`
- `https://github.com/Nirlabinc/aros/actions/runs/29860502448`

Attempting to cancel both runs returned GitHub API 500. Treat them as stale
pre-enable artifacts; they no longer indicate that current Actions scheduling is
blocked.

## Marketplace Impact

Production MCP was already patched directly on the VPS for the AROS + Regulars
launch gate, and live smoke checks still pass:

- `https://mcp.shre.ai/.well-known/mcp/customer` reports `Regulars`.
- `https://mcp.shre.ai/regulars` lists 5 read-only tools.
- `demo-market` profile, links, products, promotions, and hours return 200.

CI/deploy scheduling is no longer a marketplace blocker.
