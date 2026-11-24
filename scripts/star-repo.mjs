#!/usr/bin/env node
// `npm run star`: asks "Star HowMuch? [Y/n]" in a terminal (Enter = yes; signs in with gh first if needed).
// `npm run star -- --yes` (or HOWMUCH_CONFIRM_STAR=1): the user already agreed, so do it without asking (used by AI agents).
import { starPrompt } from './star-lib.mjs';
const yes = process.argv.includes('--yes') || process.env.HOWMUCH_CONFIRM_STAR === '1';
const out = await starPrompt({ force: true, yes });
if (out === 'skipped') { console.error('Run this in a terminal, or after the user agreed: npm run star -- --yes'); process.exitCode = 2; }
else if (['no-gh', 'no-login', 'failed'].includes(out)) process.exitCode = 1;
