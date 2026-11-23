// URL sanity for links returned by research agents. We never fetch these; the guard only keeps junk and unsafe
// links (credentials, ports, private hosts, search/social pages, cart/login paths) out of the result.
const privateHost = h => !h.includes('.') || /^\d+(\.\d+){3}$/.test(h) || h.includes(':') || h.startsWith('[') || /\.(local|localhost|internal|lan|home|test|example|invalid|corp|intranet)$/.test(h);
export function shopUrl(raw) {
  try {
    const u = new URL(raw), host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port || privateHost(host)) return null;
    if (host !== 'store.google.com' && /(^|\.)(google|bing|duckduckgo|facebook|instagram|youtube|tiktok|twitter|x)\.[a-z.]+$/i.test(host)) return null;
    if ((u.pathname === '/' && !u.search) || /\/(cart|checkout|order|login|account|logout|add-to-cart|purchase|pay)(\/|$)/i.test(u.pathname)) return null;
    u.hash = ''; return u.href;
  } catch { return null; }
}
