// "Star HowMuch on GitHub" with one tap, through GitHub's OAuth device flow. The user approves once on github.com; the
// server then stars the repo on their behalf and DISCARDS the token at once (never stored, logged or returned).
// Needs GITHUB_CLIENT_ID (a GitHub OAuth App with device flow enabled, scope public_repo). Without it the endpoints answer 501.
import { randomUUID } from 'node:crypto';

const REPO = 'NomaDamas/HowMuch';
const form = o => new URLSearchParams(o).toString();

export function githubStar({ clientId = process.env.GITHUB_CLIENT_ID, fetchImpl = fetch, now = Date.now } = {}) {
  const pending = new Map(); // pollId -> { deviceCode, expires }
  const gh = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(10000) });
  const post = (url, body) => gh(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: form(body) });
  const prune = () => { for (const [id, e] of pending) if (e.expires <= now()) pending.delete(id); };
  return {
    configured: () => Boolean(clientId),
    async start() {
      if (!clientId) return { status: 501, body: { error: 'github_oauth_not_configured' } };
      prune(); if (pending.size >= 50) return { status: 429, body: { error: 'busy' } };
      const r = await post('https://github.com/login/device/code', { client_id: clientId, scope: 'public_repo' }).catch(() => null);
      const d = r?.ok ? await r.json().catch(() => null) : null;
      if (!d?.device_code || !d.user_code || !/^https:\/\/github\.com\//.test(d.verification_uri || '')) return { status: 502, body: { error: 'github_unavailable' } };
      const pollId = randomUUID();
      pending.set(pollId, { deviceCode: d.device_code, expires: now() + Math.min(900, Number(d.expires_in) || 900) * 1000 });
      return { status: 200, body: { pollId, userCode: d.user_code, verificationUri: d.verification_uri, interval: Number(d.interval) || 5 } };
    },
    async poll(pollId) {
      const e = typeof pollId === 'string' ? pending.get(pollId) : null;
      if (!e || e.expires <= now()) { pending.delete(pollId); return { status: 410, body: { error: 'expired' } }; }
      const r = await post('https://github.com/login/oauth/access_token', { client_id: clientId, device_code: e.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }).catch(() => null);
      const d = r?.ok ? await r.json().catch(() => null) : null;
      if (!d) return { status: 502, body: { error: 'github_unavailable' } };
      if (d.error === 'authorization_pending' || d.error === 'slow_down') return { status: 200, body: { pending: true, interval: Number(d.interval) || 5 } };
      pending.delete(pollId);
      if (!d.access_token) return { status: 400, body: { error: d.error || 'denied' } };
      const star = await gh(`https://api.github.com/user/starred/${REPO}`, { method: 'PUT', headers: { authorization: 'Bearer ' + d.access_token, accept: 'application/vnd.github+json', 'user-agent': 'HowMuch', 'content-length': '0' } }).catch(() => null);
      return star?.status === 204 ? { status: 200, body: { starred: true } } : { status: 502, body: { error: 'star_failed' } };
    }
  };
}
