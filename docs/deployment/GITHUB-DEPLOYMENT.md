# GitHub Deployment Status

This repo now includes a baseline workflow at:

- `.github/workflows/deploy.yml`

## Branch Mapping

- `develop` -> `staging`
- `main` -> `prod`

## Required GitHub Secrets

- `AROS_SSH_PRIVATE_KEY`
- `AROS_MAIN_SSH_HOST`
- `AROS_STAGING_SSH_HOST`

## Runtime Ownership Gate

The workflow runs `deploy/scripts/validate-runtime-ownership.mjs` before SSH deploy to prevent environment mixups:

- `prod` requires:
  - domain `aros.live`
  - Supabase project `ionljrbrvulbmscodtzg`
- `staging` requires:
  - domain `beta.aros.live` or `dev.aros.live`
  - Supabase project `tvdvfdmpackwebfasrsw`

## Known Limitation

Current staging PM2 apps (`aros-beta`, `aros-dev`) run from `/opt/aros-platform/mib007-live`, which is not sourced from this repo.  
That path is outside this workflow's controlled source of truth.

To make deployment fully automated end-to-end, either:

1. Move the runtime app source under this repo and deploy it from this workflow.
2. Create a second workflow in the repo that owns `mib007-live` and deploy both repos with explicit promotion gating.
