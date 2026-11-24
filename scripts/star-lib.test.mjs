import test from 'node:test';
import assert from 'node:assert/strict';
import { starPrompt, REPO } from './star-lib.mjs';

const harness = ({ auth = [0], already = 1, put = 0, answers = [''], state = null, tty = true, env = {}, ghMissing = false, yes = false } = {}) => {
  const calls = [], writes = [], logs = []; let asked = 0, authCalls = 0, loggedIn = false;
  const run = (cmd, args, o) => { calls.push(args.join(' ') + (o?.stdio === 'inherit' ? ' [inherit]' : ''));
    if (args[0] === '--version') return ghMissing ? { error: new Error('ENOENT'), status: null } : { status: 0 };
    if (args[0] === 'auth' && args[1] === 'status') return { status: loggedIn ? 0 : auth[Math.min(authCalls++, auth.length - 1)] };
    if (args[0] === 'auth' && args[1] === 'login') { loggedIn = true; return { status: 0 }; }
    if (args[1] === '-X') return { status: put };
    return { status: already }; };
  return { calls, writes, logs, asked: () => asked, opts: { run, ask: async () => { const a = answers[Math.min(asked, answers.length - 1)]; asked++; return a; }, read: () => state, write: v => writes.push(v), tty, env, yes, log: m => logs.push(String(m)) } };
};

test('Enter means yes: stars immediately with the user\'s gh login and remembers it', async () => {
  const h = harness({ answers: [''] });
  assert.equal(await starPrompt(h.opts), 'starred');
  assert.ok(h.calls.includes(`api -X PUT /user/starred/${REPO}`)); assert.deepEqual(h.writes, ['starred']);
});
test('"no" is remembered and nothing is starred', async () => {
  const h = harness({ answers: ['n'] });
  assert.equal(await starPrompt(h.opts), 'declined');
  assert.ok(!h.calls.some(c => c.includes('PUT'))); assert.deepEqual(h.writes, ['declined']);
});
test('already starred: no question, remembered', async () => {
  const h = harness({ already: 0 });
  assert.equal(await starPrompt(h.opts), 'already'); assert.equal(h.asked(), 0); assert.deepEqual(h.writes, ['starred']);
});
test('never asks twice, in CI, without a terminal, or when disabled', async () => {
  for (const o of [{ state: 'declined' }, { state: 'starred' }, { tty: false }, { env: { CI: '1' } }, { env: { HOWMUCH_NO_STAR_PROMPT: '1' } }]) {
    const h = harness(o); assert.equal(await starPrompt(h.opts), 'skipped'); assert.equal(h.asked(), 0); assert.deepEqual(h.calls, []);
  }
});
test('without the GitHub CLI it says how to install it and does not ask or remember', async () => {
  const h = harness({ ghMissing: true });
  assert.equal(await starPrompt(h.opts), 'no-gh'); assert.equal(h.asked(), 0); assert.deepEqual(h.writes, []); assert.match(h.logs.join(' '), /brew install gh/);
});
test('a failed star is reported, not remembered; an unclear answer does nothing', async () => {
  assert.equal(await starPrompt(harness({ put: 1 }).opts), 'failed');
  const h = harness({ answers: ['maybe'] }); assert.equal(await starPrompt(h.opts), 'skipped'); assert.deepEqual(h.writes, []);
  const forced = harness({ state: 'declined', answers: [''] }); assert.equal(await starPrompt({ ...forced.opts, force: true }), 'starred', 'npm run star ignores the remembered answer');
});

test('closed input (no answer) skips quietly and even `npm run star` needs a terminal', async () => {
  const h = harness({}); h.opts.ask = async () => null; assert.equal(await starPrompt(h.opts), 'skipped'); assert.deepEqual(h.writes, []);
  const noTty = harness({ tty: false }); assert.equal(await starPrompt({ ...noTty.opts, force: true }), 'skipped'); assert.equal(noTty.asked(), 0);
});

test('not signed in: with approval it runs `gh auth login --web`, then stars with the same account', async () => {
  const h = harness({ auth: [1, 1], answers: ['', ''] });
  assert.equal(await starPrompt(h.opts), 'starred');
  const login = h.calls.find(c => c.startsWith('auth login')); assert.match(login, /--web/); assert.match(login, /\[inherit\]/);
  assert.ok(h.calls.indexOf(login) < h.calls.findIndex(c => c.includes('PUT')), 'sign in before starring'); assert.equal(h.asked(), 2);
});
test('declining the sign-in is remembered and nothing is opened', async () => {
  const h = harness({ auth: [1], answers: ['n'] });
  assert.equal(await starPrompt(h.opts), 'declined'); assert.ok(!h.calls.some(c => c.startsWith('auth login'))); assert.deepEqual(h.writes, ['declined']);
});
test('an AI agent (no terminal) gets a clear request to relay to the user and nothing is done', async () => {
  const h = harness({ tty: false });
  assert.equal(await starPrompt(h.opts), 'skipped'); assert.deepEqual(h.calls, []);
  assert.match(h.logs.join('\n'), /npm run star -- --yes/); assert.match(h.logs.join('\n'), /Star HowMuch on GitHub/);
  const ci = harness({ tty: false, env: { CI: '1' } }); await starPrompt(ci.opts); assert.deepEqual(ci.logs, [], 'silent in CI');
  const done = harness({ tty: false, state: 'starred' }); await starPrompt(done.opts); assert.deepEqual(done.logs, [], 'silent once starred or declined');
});
test('`--yes` after the user agreed: no question, signs in if needed, stars, works without a terminal', async () => {
  const h = harness({ tty: false, yes: true, auth: [1, 1] });
  assert.equal(await starPrompt({ ...h.opts, force: true }), 'starred'); assert.equal(h.asked(), 0);
  assert.ok(h.calls.some(c => c.startsWith('auth login')) && h.calls.some(c => c.includes('PUT')));
});
