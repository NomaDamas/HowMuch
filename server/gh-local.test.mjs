import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ghLocal, localHost, REPO } from './gh-local.mjs';

const fakeRun = ({ installed = true, signedIn = true, starred = false, user = 'octo', put = 0 } = {}) => { const calls = [];
  const run = (cmd, args) => { calls.push(args.join(' '));
    if (args[0] === '--version') return installed ? { status: 0, stdout: 'gh 2' } : { error: new Error('ENOENT') };
    if (args[0] === 'auth') return { status: signedIn ? 0 : 1 };
    if (args[0] === 'api' && args[1] === 'user') return { status: 0, stdout: user + '\n' };
    if (args[1] === '-X') return { status: put };
    return { status: starred ? 0 : 1 }; };
  return { run, calls }; };

test('status reports the signed-in account so the user knows who will star', () => {
  const g = ghLocal({ run: fakeRun({ user: 'minsing-jin' }).run });
  assert.deepEqual(g.status(), { enabled: true, installed: true, signedIn: true, user: 'minsing-jin', starred: false });
});
test('stars only the fixed repo, as the signed-in user, once; an existing star is not repeated', () => {
  const f = fakeRun(); const g = ghLocal({ run: f.run });
  assert.deepEqual(g.star(), { status: 200, body: { starred: true, user: 'octo' } });
  assert.ok(f.calls.includes(`api -X PUT /user/starred/${REPO}`)); assert.equal(f.calls.filter(c => c.includes('-X PUT')).length, 1);
  const done = fakeRun({ starred: true }); assert.equal(ghLocal({ run: done.run }).star().body.starred, true); assert.ok(!done.calls.some(c => c.includes('PUT')));
});
test('without a sign-in or the CLI, nothing is starred and the reason is explicit', () => {
  assert.equal(ghLocal({ run: fakeRun({ signedIn: false }).run }).star().status, 401);
  assert.equal(ghLocal({ run: fakeRun({ installed: false }).run }).status().installed, false);
  assert.equal(ghLocal({ run: fakeRun({ put: 1 }).run }).star().status, 502);
});
test('an account name is sanitised and the feature can be switched off', () => {
  assert.equal(ghLocal({ run: fakeRun({ user: 'a b;rm -rf /' }).run }).status().user, 'abrm-rf');
  const off = ghLocal({ run: fakeRun().run, env: { HOWMUCH_LOCAL_GH: '0' } });
  assert.deepEqual(off.status(), { enabled: false }); assert.equal(off.star().status, 404);
});
test('sign-in runs `gh auth login --web`, returns the one-time code, and presses Enter for the user', async () => {
  const proc = new EventEmitter(); proc.stdout = new EventEmitter(); proc.stderr = new EventEmitter(); let wrote = ''; proc.stdin = { write: s => { wrote += s; } }; proc.kill = () => { proc.emit('exit'); };
  let args; const launch = (cmd, a) => { args = a; setTimeout(() => proc.stderr.emit('data', '! First copy your one-time code: ABCD-1234\nPress Enter to open github.com'), 5); return proc; };
  const g = ghLocal({ run: fakeRun({ signedIn: false }).run, launch });
  const out = await g.startLogin();
  assert.deepEqual(out.body, { code: 'ABCD-1234', url: 'https://github.com/login/device' });
  assert.ok(args.includes('--web') && args.includes('public_repo')); assert.equal(wrote, '\n');
  assert.equal((await g.startLogin()).body.code, 'ABCD-1234', 'a second tap reuses the running sign-in');
  assert.equal(g.status().login.code, 'ABCD-1234');
});
test('local star is only offered on loopback or private-LAN hosts', () => {
  for (const h of ['localhost:8787', '127.0.0.1:8787', '192.168.0.3:8443', '10.1.2.3', '172.20.1.1:8443']) assert.equal(localHost(h), true, h);
  for (const h of ['howmuch.example.com', '8.8.8.8', '172.40.0.1', '']) assert.equal(localHost(h), false, h);
});
