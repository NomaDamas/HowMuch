#!/usr/bin/env node
// `npm run star`: asks "Star HowMuch? [Y/n]" in a terminal (Enter = yes). Non-interactive use needs HOWMUCH_CONFIRM_STAR=1.
import { starPrompt, REPO } from './star-lib.mjs';
import { spawnSync } from 'node:child_process';
if (process.env.HOWMUCH_CONFIRM_STAR === '1') {
  const r = spawnSync('gh', ['api', '-X', 'PUT', `/user/starred/${REPO}`], { stdio: 'inherit' });
  console.log(r.status === 0 ? '⭐ Starred. Thank you!' : 'GitHub CLI (gh) must be installed and signed in (`gh auth login`).');
  process.exitCode = r.status ?? 1;
} else {
  const out = await starPrompt({ force: true });
  if (out === 'skipped') { console.error(`Run this in a terminal, or: HOWMUCH_CONFIRM_STAR=1 npm run star  (stars ${REPO} with your gh login)`); process.exitCode = 2; }
}
