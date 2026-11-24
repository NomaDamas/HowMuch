import test from 'node:test';
import assert from 'node:assert/strict';
import { starPrompt, REPO } from './star-lib.mjs';

const harness = ({ auth = 0, already = 1, put = 0, answer = '', state = null, tty = true, env = {} } = {}) => {
  const calls = [], writes = []; let asked = 0;
  const run = (cmd, args) => { calls.push(args.join(' ')); if (args[0] === 'auth') return { status: auth }; if (args[1] === '-X') return { status: put }; return { status: already }; };
  return { calls, writes, asked: () => asked, opts: { run, ask: async () => { asked++; return answer; }, read: () => state, write: v => writes.push(v), tty, env, log: () => {} } };
};

test('Enter means yes: stars immediately with the user\'s gh login and remembers it', async () => {
  const h = harness({ answer: '' });
  assert.equal(await starPrompt(h.opts), 'starred');
  assert.ok(h.calls.includes(`api -X PUT /user/starred/${REPO}`)); assert.deepEqual(h.writes, ['starred']);
});
test('"no" is remembered and nothing is starred', async () => {
  const h = harness({ answer: 'n' });
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
test('without gh sign-in it points to `gh auth login` and does not ask or remember', async () => {
  const h = harness({ auth: 1 });
  assert.equal(await starPrompt(h.opts), 'no-gh'); assert.equal(h.asked(), 0); assert.deepEqual(h.writes, []);
});
test('a failed star is reported, not remembered; an unclear answer does nothing', async () => {
  assert.equal(await starPrompt(harness({ put: 1 }).opts), 'failed');
  const h = harness({ answer: 'maybe' }); assert.equal(await starPrompt(h.opts), 'skipped'); assert.deepEqual(h.writes, []);
  const forced = harness({ state: 'declined' }); assert.equal(await starPrompt({ ...forced.opts, force: true }), 'starred', 'npm run star ignores the remembered answer');
});

test('closed input (no answer) skips quietly and even `npm run star` needs a terminal', async () => {
  const h = harness({}); h.opts.ask = async () => null; assert.equal(await starPrompt(h.opts), 'skipped'); assert.deepEqual(h.writes, []);
  const noTty = harness({ tty: false }); assert.equal(await starPrompt({ ...noTty.opts, force: true }), 'skipped'); assert.equal(noTty.asked(), 0);
});
