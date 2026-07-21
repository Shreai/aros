# CI Deploy Queue Note

Status date: 2026-07-21

Two manual production deploy workflow runs are stuck in GitHub Actions `queued` state with no jobs created:

- `https://github.com/Nirlabinc/aros/actions/runs/29859156916`
- `https://github.com/Nirlabinc/aros/actions/runs/29860502448`

Attempting to cancel run `29859156916` returned a GitHub API 500.

The deploy workflow uses GitHub-hosted `ubuntu-latest`; the repository currently reports zero self-hosted runners, which is expected for this workflow. Because jobs are not being created at all, this appears to be a GitHub Actions org/repo scheduling, billing, or policy issue rather than a code/test failure.

Production was patched directly on the VPS for the AROS + Regulars launch gate, and live smoke checks passed:

- `https://mcp.shre.ai/.well-known/mcp/customer` reports `Regulars`.
- `https://mcp.shre.ai/regulars` lists 5 read-only tools.
- `demo-market` profile, links, products, promotions, and hours return 200.

Follow-up:

- Check org Actions billing/allowance and Actions policy settings.
- Cancel stale queued runs from the GitHub UI if API cancellation continues to fail.
- Re-run `Deploy AROS` after Actions queueing is healthy.
