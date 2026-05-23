#!/usr/bin/env node

/**
 * Prevent accidental cross-environment deploys by validating
 * expected runtime ownership for each target environment.
 */

const targetEnv = process.env.TARGET_ENV;
const runtimeRepo = process.env.RUNTIME_REPO;
const publicUrl = process.env.PUBLIC_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || "";

if (!targetEnv || !runtimeRepo) {
  console.error("Missing TARGET_ENV or RUNTIME_REPO");
  process.exit(1);
}

const policy = {
  prod: {
    runtimeRepo: "aros",
    urlIncludes: ["aros.live"],
    supabaseIncludes: ["ionljrbrvulbmscodtzg.supabase.co"],
  },
  staging: {
    runtimeRepo: "aros",
    urlIncludes: ["beta.aros.live", "dev.aros.live"],
    supabaseIncludes: ["tvdvfdmpackwebfasrsw.supabase.co"],
  },
};

const expected = policy[targetEnv];
if (!expected) {
  console.error(`Unsupported TARGET_ENV: ${targetEnv}`);
  process.exit(1);
}

if (runtimeRepo !== expected.runtimeRepo) {
  console.error(
    `Runtime repo mismatch: got ${runtimeRepo}, expected ${expected.runtimeRepo} for ${targetEnv}`,
  );
  process.exit(1);
}

if (
  publicUrl &&
  expected.urlIncludes.length > 0 &&
  !expected.urlIncludes.some((v) => publicUrl.includes(v))
) {
  console.error(
    `PUBLIC_URL (${publicUrl}) does not match expected ${targetEnv} domains: ${expected.urlIncludes.join(
      ", ",
    )}`,
  );
  process.exit(1);
}

if (
  supabaseUrl &&
  expected.supabaseIncludes.length > 0 &&
  !expected.supabaseIncludes.some((v) => supabaseUrl.includes(v))
) {
  console.error(
    `SUPABASE_URL (${supabaseUrl}) does not match expected ${targetEnv} Supabase project(s): ${expected.supabaseIncludes.join(
      ", ",
    )}`,
  );
  process.exit(1);
}

console.log(`Runtime ownership validation passed for ${targetEnv}`);
