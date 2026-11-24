#!/usr/bin/env node
// Asks once, interactively, whether to star the repo after `npm install`.
// Never stars without an explicit "y", never in CI/non-TTY, never stores credentials.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, writeFileSync } from 'node:fs';

const repo = 'NomaDamas/HowMuch', marker = new URL('../.howmuch-star-asked', import.meta.url);
if (process.env.CI || process.env.HOWMUCH_NO_STAR_PROMPT || !process.stdin.isTTY || !process.stdout.isTTY || existsSync(marker)) process.exit(0);
const gh = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
if (gh.error || gh.status !== 0) process.exit(0);
try { writeFileSync(marker, new Date().toISOString()); } catch {}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`⭐ HowMuch가 마음에 드시나요? GitHub CLI 계정으로 ${repo}에 Star를 누를까요? [Y/n] `)).trim().toLowerCase();
rl.close();
if (answer === '' || answer === 'y' || answer === 'yes') spawnSync('gh', ['api', '-X', 'PUT', `/user/starred/${repo}`], { stdio: 'inherit' });
