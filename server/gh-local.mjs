// Star from the app or the screen using the GitHub CLI that is signed in on THIS machine (the user's own computer running
// the demo). Only the fixed repo is ever starred, the account is shown to the user before they approve, a token is never
// read, stored or returned, and the endpoints are available only when the server runs locally (loopback or a private LAN
// address) and HOWMUCH_LOCAL_GH is not "0". For a shared deployment use the OAuth device flow (github-star.mjs) instead.
import { spawn, spawnSync } from 'node:child_process';

export const REPO = 'NomaDamas/HowMuch';
const CODE = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/;

export const localHost = host => /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(String(host || ''));

export function ghLocal({ run = spawnSync, launch = spawn, env = process.env, loginTimeoutMs = 180000 } = {}) {
  const sh = (args, timeout = 8000) => { const r = run('gh', args, { encoding: 'utf8', timeout }); return r.error ? { status: 127, out: '' } : { status: r.status, out: String(r.stdout || '').trim() }; };
  let login = null; // single sign-in at a time: { code, url, proc, startedAt }
  const enabled = () => env.HOWMUCH_LOCAL_GH !== '0';
  function status() {
    if (!enabled()) return { enabled: false };
    if (sh(['--version']).status !== 0) return { enabled: true, installed: false, signedIn: false, starred: false };
    if (sh(['auth', 'status']).status !== 0) return { enabled: true, installed: true, signedIn: false, starred: false, login: login ? { code: login.code, url: login.url } : null };
    if (login) { try { login.proc.kill(); } catch { /* already finished */ } login = null; }
    const user = sh(['api', 'user', '--jq', '.login']).out.replace(/[^\w-]/g, '').slice(0, 39);
    return { enabled: true, installed: true, signedIn: true, user, starred: sh(['api', `/user/starred/${REPO}`]).status === 0 };
  }
  function star() {
    const s = status();
    if (!s.enabled) return { status: 404, body: { error: 'disabled' } };
    if (!s.signedIn) return { status: 401, body: { error: 'gh_not_signed_in' } };
    if (s.starred) return { status: 200, body: { starred: true, user: s.user } };
    return sh(['api', '-X', 'PUT', `/user/starred/${REPO}`]).status === 0 ? { status: 200, body: { starred: true, user: s.user } } : { status: 502, body: { error: 'star_failed' } };
  }
  /** Starts `gh auth login --web`; resolves with the one-time code the user types at github.com/login/device. */
  function startLogin() {
    if (!enabled()) return Promise.resolve({ status: 404, body: { error: 'disabled' } });
    if (sh(['--version']).status !== 0) return Promise.resolve({ status: 424, body: { error: 'gh_not_installed' } });
    if (login?.code) return Promise.resolve({ status: 200, body: { code: login.code, url: login.url } });
    return new Promise(resolve => {
      const proc = launch('gh', ['auth', 'login', '--web', '--hostname', 'github.com', '--git-protocol', 'https', '--scopes', 'public_repo'], { stdio: ['pipe', 'pipe', 'pipe'] });
      const entry = { code: null, url: 'https://github.com/login/device', proc, startedAt: Date.now() }; login = entry;
      let seen = '';
      const take = chunk => { seen += chunk; const m = CODE.exec(seen); if (m && !entry.code) { entry.code = m[1]; resolve({ status: 200, body: { code: entry.code, url: entry.url } }); try { proc.stdin.write('\n'); } catch { /* proc ended */ } } };
      proc.stdout?.on('data', take); proc.stderr?.on('data', take);
      const timer = setTimeout(() => { try { proc.kill(); } catch { /* done */ } }, loginTimeoutMs); timer.unref?.();
      proc.once('exit', () => { clearTimeout(timer); if (login === entry) login = null; if (!entry.code) resolve({ status: 502, body: { error: 'login_failed' } }); });
      proc.once('error', () => { clearTimeout(timer); if (login === entry) login = null; resolve({ status: 424, body: { error: 'gh_not_installed' } }); });
      setTimeout(() => { if (!entry.code) resolve({ status: 504, body: { error: 'login_timeout' } }); }, 12000).unref?.();
    });
  }
  return { status, star, startLogin, enabled };
}
