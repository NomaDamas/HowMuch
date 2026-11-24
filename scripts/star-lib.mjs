// One place for every "Star HowMuch on GitHub?" prompt (npm install, npm run demo/dev, npm run star).
// Asks in an interactive terminal only, takes Enter as yes, stars immediately through the user's own `gh` login,
// remembers "starred" or "declined" so it never nags, and never stores or prints a token.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const REPO = 'NomaDamas/HowMuch';
const STATE = new URL('../.howmuch-star', import.meta.url);
export const readState = () => { try { return existsSync(STATE) ? readFileSync(STATE, 'utf8').trim() : null; } catch { return null; } };
export const writeState = v => { try { writeFileSync(STATE, v); } catch { /* read-only checkout: ask again next time */ } };
// Resolves null when the input closes (EOF) so a missing terminal can never hang or crash the command.
const defaultAsk = q => new Promise(resolve => { const rl = createInterface({ input: process.stdin, output: process.stdout }); rl.once('close', () => resolve(null)); rl.question(q).then(a => { resolve(a); rl.close(); }, () => resolve(null)); });

/** Returns what happened: skipped | no-gh | already | starred | declined | failed. */
export async function starPrompt({ run = spawnSync, ask = defaultAsk, read = readState, write = writeState, tty = Boolean(process.stdin.isTTY && process.stdout.isTTY), env = process.env, force = false, log = console.log } = {}) {
  if (!tty || (!force && (env.CI || env.HOWMUCH_NO_STAR_PROMPT || read()))) return 'skipped';
  const sh = (args) => run('gh', args, { stdio: 'ignore' });
  const auth = sh(['auth', 'status']);
  if (auth.error || auth.status !== 0) { log('Star HowMuch: sign in with `gh auth login`, then run `npm run star`.'); return 'no-gh'; }
  if (sh(['api', `/user/starred/${REPO}`]).status === 0) { write('starred'); return 'already'; }
  const raw = await ask('⭐ Star HowMuch on GitHub to support the developer? [Y/n] ');
  if (raw == null) return 'skipped';                       // input closed: no answer, no action
  const answer = String(raw).trim().toLowerCase();
  if (answer === 'n' || answer === 'no') { write('declined'); return 'declined'; }
  if (answer !== '' && answer !== 'y' && answer !== 'yes') return 'skipped';
  const put = sh(['api', '-X', 'PUT', `/user/starred/${REPO}`]);
  if (put.status === 0) { write('starred'); log('⭐ Starred. Thank you!'); return 'starred'; }
  log('Could not star automatically. Open https://github.com/' + REPO + ' and press the star.'); return 'failed';
}
