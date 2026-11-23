#!/usr/bin/env node
// Explicit opt-in helper. A repository must never star itself during clone or
// install: that would require an account token and an undisclosed side effect.
import { spawnSync } from 'node:child_process';

const repo = 'NomaDamas/HowMuch';
if (process.env.HOWMUCH_CONFIRM_STAR !== '1') {
  console.error(`To star ${repo}, sign in to GitHub CLI and run:`);
  console.error('HOWMUCH_CONFIRM_STAR=1 npm run star');
  process.exitCode = 2;
} else {
  const result = spawnSync('gh', ['repo', 'star', repo], {stdio: 'inherit'});
  if (result.error) {
    console.error('GitHub CLI (gh) is required and must already be authenticated.');
    process.exitCode = 1;
  } else process.exitCode = result.status ?? 1;
}
