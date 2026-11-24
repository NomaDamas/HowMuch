import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Star, X, Check, ScanLine, Camera } from 'lucide-react';
import { t, setLang, getLang, useLang, numberFormat } from './lib/i18n.js';
import { summarizeCard, amount, spatialHandoff } from './lib/price-card.js';
import WorldAnchorButton from './WorldAnchorButton.jsx';

export const REPO_URL = 'https://github.com/NomaDamas/HowMuch';

/** What to call an object: "Brand Model", else the type name the agents found, else a neutral word. */
export function nameOf(o) {
  if (o.phase === 'person') return t('card.person');
  const r = o.result, id = r?.identity;
  const model = id?.model ? [id.brand, id.model].filter(Boolean).join(' ') : '';
  return model || r?.candidates?.[0]?.name || o.candidate?.name || t('card.object');
}
/** What the research agents are really doing, as short text ("Searching “Switch OLED price”", "Reading enuri.com"). */
export const stepText = st => st ? t('act.' + st.kind, { text: st.text || '', n: st.n ?? '' }) : '';
export function stages(o) {
  const a = o.activity || [], done = a.filter(s => s.kind === 'agentDone').length;
  return { flags: [a.some(s => s.kind === 'identified') || Boolean(o.candidate), a.some(s => s.kind === 'search' || s.kind === 'open'), done >= 1, a.some(s => s.kind === 'compare') || done >= 2], done };
}
const busy = o => ['segmenting', 'identifying', 'loading'].includes(o.phase);
export const stateText = o => o.error ? t('st.failed') : o.phase === 'segmenting' ? t('st.segmenting') : o.phase === 'identifying' ? t('st.identifying') : o.phase === 'loading' ? t('st.searching')
  : o.phase === 'research_unavailable' ? t('st.unavailable') : o.phase === 'followup_required' ? t('st.needModel') : o.visibility === 'reacquiring' ? t('st.reacquiring') : o.visibility === 'lost' ? t('st.lost') : '';
export function priceOf(o, fun) {
  if (!o.result && o.preliminary && busy(o)) return '~₩' + o.preliminary.price.toLocaleString('en-US');
  if (o.phase === 'person') return fun && o.coins ? '₩' + o.coins.price.toLocaleString(numberFormat()) : '—';
  if (busy(o)) return '';
  return summarizeCard(o.result).price;
}

/** Bottom sheet: swipe down, drag the handle, or tap outside to close. No close button. */
export function Sheet({ label, onClose, children }) {
  const ref = useRef(null), drag = useRef(null);
  const place = (y) => { const el = ref.current; if (!el) return; el.style.transition = y ? 'none' : 'transform .2s'; el.style.transform = y ? `translateY(${y}px)` : ''; };
  const begin = y => { drag.current = { y0: y, dy: 0 }; };
  const move = y => { const d = drag.current; if (!d) return; d.dy = Math.max(0, y - d.y0); place(d.dy); };
  const end = () => { const d = drag.current; drag.current = null; if (!d) return; if (d.dy > 90) onClose(); else place(0); };
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="back" onClick={onClose}>
    <section ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}
      onTouchStart={e => { if (ref.current.scrollTop <= 0) begin(e.touches[0].clientY); }} onTouchMove={e => move(e.touches[0].clientY)} onTouchEnd={end} onTouchCancel={end}>
      <div className="grab" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); begin(e.clientY); }} onPointerMove={e => move(e.clientY)} onPointerUp={end} onPointerCancel={end} />
      {children}
    </section>
  </div>;
}

/** Top control: one chip per object (tap to focus that object, tap again for all). */
export function ItemBar({ items, filter, setFilter, cancel, fun }) {
  useLang();
  if (!items.length) return null;
  return <div className="itembar" role="toolbar" aria-label={t('bar.aria')}>
    {items.length > 1 && <button className={'chip all ' + (filter == null ? 'on' : '')} onClick={() => setFilter(null)}>{t('bar.all')}</button>}
    {items.map(o => <button key={o.id} className={'chip job-chip ' + (filter === o.id ? 'on' : '')} onClick={() => setFilter(filter === o.id ? null : o.id)}>
      {o.selection?.cutoutDataUrl ? <img alt="" src={o.selection.cutoutDataUrl} /> : <span className="dot" />}
      <span className="chip-text"><span className="chip-name">{nameOf(o)}</span><span className="chip-price">{priceOf(o, fun) || stateText(o)}</span></span>
      <span className="chip-x job-chip-x" role="button" aria-label={t('bar.remove')} onClick={e => { e.stopPropagation(); cancel(o.id); }}><X size={15} /></span>
    </button>)}
  </div>;
}

export function Leader({ box, ax, ay, phase }) {
  const sx = Math.max(box.x, Math.min(ax, box.x + box.width)), sy = Math.max(box.y, Math.min(ay, box.y + box.height)), inside = sx === ax && sy === ay;
  return <svg className={'leader ' + phase} aria-hidden="true">{!inside && <line x1={sx} y1={sy} x2={ax} y2={ay} />}<circle className="anchor-core" cx={ax} cy={ay} r="4" /><circle className="anchor-ripple" cx={ax} cy={ay} r="9" /><circle className="anchor-ripple two" cx={ax} cy={ay} r="9" /></svg>;
}

/** The card on the object: model and price, nothing else. */
export function Hud({ o, box, tilt, measure, open, fun }) {
  useLang();
  const node = useRef(null), ref = useRef(measure); ref.current = measure;
  useLayoutEffect(() => { const read = () => { const r = node.current.getBoundingClientRect(); ref.current(o.id, { width: r.width, height: r.height }); }; read(); const ro = new ResizeObserver(read); ro.observe(node.current); return () => ro.disconnect(); }, [o.id]);
  const r = o.result, price = priceOf(o, fun), last = busy(o) ? (o.activity || []).at(-1) : null, prelim = busy(o) && !r && o.preliminary ? t('price.prelim', { n: o.preliminary.count }) : '', sub = o.phase === 'person' ? '' : r?.pricingMode === 'type_estimate' ? t('price.estimate').split(' · ')[0] : (prelim || (last ? stepText(last) : stateText(o)));
  return <button className="card" ref={node} style={{ left: box.x, top: box.y, '--ry': (tilt?.ry || 0) + 'deg', '--rx': (tilt?.rx || 0) + 'deg', '--k': tilt?.k || 1 }} onClick={open} data-object-id={o.id} data-phase={o.phase}>
    <span className="card-name">{nameOf(o)}</span>
    {busy(o) && !price ? <span className="skeleton" /> : <span className={'card-price' + (busy(o) ? ' prelim' : '')}>{price}</span>}
    {(sub || busy(o)) && <span className={'card-sub' + (busy(o) ? ' live' : '')}>{busy(o) ? (sub || stateText(o)) : sub}</span>}
  </button>;
}

const cond = c => c === 'new' ? t('detail.new') : c === 'used' ? t('detail.used') : t('detail.unknownCond');
const stock = a => a === 'in_stock' ? t('detail.inStock') : a === 'out_of_stock' ? t('detail.soldOut') : t('detail.stockUnknown');
const when = iso => iso ? new Date(iso).toLocaleString(numberFormat()) : '';

/** Shown while research runs: stage bar plus the agents' real actions as they happen. */
function WorkPanel({ o }) {
  useLang();
  const { flags, done } = stages(o), feed = (o.activity || []).slice(-6);
  const names = ['work.identify', 'work.search', 'work.compare', 'work.verify'];
  return <div className="work" role="status" aria-live="polite">
    <div className="work-head"><strong>{t('work.title')}</strong><small>{done > 0 ? t('work.agents', { n: done }) : t('work.wait')}</small></div>
    <div className="stages">{names.map((n, i) => <div key={n} className={'stage ' + (flags[i] ? 'on' : flags.findIndex(f => !f) === i ? 'now' : '')}><i /><span>{t(n)}</span></div>)}</div>
    <ul className="feed">{feed.map((st, i) => <li key={i + stepText(st)} className={'step ' + st.kind}>{stepText(st)}</li>)}</ul>
  </div>;
}

/** Tap an object: model and price first; everything else is behind "Details". */
export function Detail({ o, close, click, fun, beginLabel, refine, pause, resume }) {
  useLang();
  const [more, setMore] = useState(false);
  const r = o.result, display = summarizeCard(r), est = r?.estimate, repr = r?.representative, name = nameOf(o), isBusy = busy(o);
  const person = o.phase === 'person';
  const nativeURL = !person && !isBusy ? spatialHandoff(name, display.label, o.signature) : null;
  const mobile = /(iPhone|iPad|Android)/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const typed = useRef(null);
  return <Sheet label={name} onClose={close}>
    <h2>{name}</h2>
    {person ? <><div className="big-price">{priceOf(o, fun)}</div><p className="basis">{fun && o.coins ? t(o.coins.vibe) : t('detail.person')}</p></>
      : isBusy ? <WorkPanel o={o} />
      : o.error ? <p>{o.error}</p>
      : o.phase === 'research_unavailable' ? <p>{t('detail.unavailable')}</p>
      : <><div className="big-price">{display.price}</div><p className="basis">{display.type}</p></>}
    {!person && !isBusy && r?.followup && o.original && <>
      <p>{r.followup.prompt || t('model.hint')}</p>
      <form className="model-form" onSubmit={e => { e.preventDefault(); refine(typed.current.value); }}>
        <input ref={typed} name="model" aria-label={t('model.aria')} placeholder={t('model.placeholder')} maxLength={80} autoComplete="off" />
        <button className="primary">{t('model.search')}</button>
      </form>
      <button className="option" onClick={beginLabel}><Camera size={18} />{t('model.scan')}</button></>}
    {!person && !isBusy && (r?.offers?.length > 0 || nativeURL) && <>
      <button className="more" aria-expanded={more} onClick={() => setMore(m => !m)}>{more ? t('detail.less') : t('detail.more')}<ChevronDown size={18} /></button>
      {more && <>
        {est && <p>{r.pricingMode === 'market_unit' ? t('detail.marketNote', { u: est.unit, r: est.region && est.region !== '전국' ? est.region : t('price.region.all'), d: est.observedAt || '' }) : t('detail.estimateNote')}</p>}
        {est && <div className="stats"><div><small>{t('detail.mean')}</small><b>{amount(est.mean, est.currency)}</b></div><div><small>{t('detail.median')}</small><b>{amount(est.median, est.currency)}</b></div><div><small>{t('detail.range')}</small><b>{amount(est.min, est.currency)}–{amount(est.max, est.currency)}</b></div></div>}
        {!est && repr && repr.sampleCount > 1 && <div className="stats"><div><small>{t('detail.median')}</small><b>{amount(repr.median, repr.currency)}</b></div><div><small>{t('detail.range')}</small><b>{amount(repr.min, repr.currency)}–{amount(repr.max, repr.currency)}</b></div><div><small>{t('detail.sources')}</small><b>{t('detail.samples', { n: repr.sampleCount })}</b></div></div>}
        {r?.offers?.map((a, i) => <a key={i} className="source" href={a.url} target="_blank" rel="noopener noreferrer" onClick={click}>
          <strong>{a.title}</strong><span>{a.merchant.replace(/^www\./, '')}<b>{amount(a.price, a.currency)}{a.unit ? ' / ' + a.unit : ''} <ExternalLink size={13} /></b></span>
          <small>{cond(a.condition)} · {stock(a.availability)} · {when(a.checkedAt)}</small></a>)}
        {repr?.exchange && <p><small>{t('detail.exchange', { d: repr.exchange.date })}</small></p>}
        {nativeURL && <><WorldAnchorButton title={name} price={display.label} target={o.signature} onSessionStart={pause} onSessionEnd={resume} />{mobile && <a className="option" href={nativeURL}>{t('xr.open')}</a>}</>}
      </>}
    </>}
  </Sheet>;
}

export function ItemsSheet({ items, fun, close, open, cancel }) {
  useLang();
  return <Sheet label={t('sheet.items')} onClose={close}>
    <h2>{t('sheet.items')}</h2>
    {!items.length && <p>{t('sheet.empty')}</p>}
    {items.map(o => <div className="row" key={o.id}>
      <button className="row-btn" onClick={() => open(o.id)}>{o.selection?.cutoutDataUrl && <img alt="" src={o.selection.cutoutDataUrl} />}<span><strong>{nameOf(o)}</strong><br /><small>{priceOf(o, fun) || stateText(o)}</small></span></button>
      <button className="icon-btn" aria-label={t('sheet.cancelListItem', { n: o.id })} onClick={() => cancel(o.id)}><X size={18} /></button>
    </div>)}
  </Sheet>;
}

export function SettingsSheet({ close, fun, setFun, pair, star }) {
  const lang = useLang();
  return <Sheet label={t('sheet.settings')} onClose={close}>
    <h2>{t('sheet.settings')}</h2>
    <div className="row"><span>{t('settings.language')}</span><div className="seg" role="group" aria-label={t('settings.language')}>
      {[['en', 'English'], ['ko', '한국어']].map(([k, n]) => <button key={k} className={lang === k ? 'on' : ''} aria-pressed={lang === k} onClick={() => setLang(k)}>{n}</button>)}</div></div>
    <div className="row"><span>{t('settings.fun')}</span><button className="switch" role="switch" aria-checked={fun} aria-label={t('settings.fun')} onClick={() => setFun(!fun)} /></div>
    <div className="settings-links">
      <button className="option" onClick={pair}>{t('settings.pair')}</button>
      <button className="option" onClick={star}><Star size={18} />{t('settings.star')}</button>
      <a className="option" href={REPO_URL} target="_blank" rel="noreferrer">{t('settings.source')}</a>
    </div>
    <p className="about">{t('settings.about')}</p>
  </Sheet>;
}

const STAR_KEY = 'howmuch-starred';
export const hasStarred = () => { try { return localStorage.getItem(STAR_KEY) === '1'; } catch { return false; } };
const markStarred = () => { try { localStorage.setItem(STAR_KEY, '1'); } catch { /* ignore */ } };
/** Phones and the app shells never see the star prompt on load; it is only for the desktop web app (Settings works everywhere). */
export const onPhone = () => typeof navigator !== 'undefined' && /(HowMuchApp|iPhone|iPad|Android)/i.test(navigator.userAgent);
export const shouldAskStar = () => !hasStarred() && !onPhone();

const api = async (url, init) => { const r = await fetch(url, init); if (!(r.headers.get('content-type') || '').includes('json')) throw Error('not_json'); return { ok: r.ok, status: r.status, body: await r.json() }; };

/** The star button and everything behind it. Nothing is starred until the user taps the star. With the GitHub CLI signed in
 *  on the computer running HowMuch, the button names the account ("Star as @you"); if the CLI is not signed in, one tap
 *  starts the sign-in and shows the one-time code; otherwise a GitHub OAuth app (device flow) or the repo page is used. */
export function StarFlow({ onDone }) {
  useLang();
  const [gh, setGh] = useState(null), [phase, setPhase] = useState('loading'), [code, setCode] = useState(null), [error, setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const finish = (already) => { markStarred(); setPhase(already ? 'already' : 'done'); setTimeout(onDone, 1200); };
  const refresh = async () => { try { const r = await api('/api/github/star/status'); setGh(r.body); return r.body; } catch { const none = { enabled: false }; setGh(none); return none; } };
  useEffect(() => { (async () => { const s = await refresh(); if (s.starred) finish(true); else setPhase('ready'); })(); }, []);
  const local = gh?.enabled && gh.installed;

  async function starNow() {                       // the tap is the approval
    setError(''); setPhase('working');
    try { const r = await api('/api/github/star/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) }); if (r.ok && r.body.starred) return finish(); throw Error(); }
    catch { setPhase('ready'); setError(t('star.fail')); }
  }
  async function signIn() {
    setError(''); setPhase('working');
    try {
      const r = await api('/api/github/star/login', { method: 'POST' }); if (!r.ok) throw Error();
      setCode(r.body); setPhase('code');
      const poll = async () => { const s = await refresh(); if (s.signedIn) { setCode(null); setPhase('ready'); if (s.starred) finish(true); } else timer.current = setTimeout(poll, 3000); };
      timer.current = setTimeout(poll, 3000);
    } catch { setPhase('ready'); setError(t('star.fail')); }
  }
  async function oauth() {                         // shared server with a GitHub OAuth app: device flow
    setError('');
    try {
      const r = await api('/api/github/star/start', { method: 'POST' });
      if (r.status === 501) { window.open(REPO_URL, '_blank', 'noopener'); return setPhase('manual'); }
      if (!r.ok) throw Error(); const d = r.body; setCode({ code: d.userCode, url: d.verificationUri }); setPhase('code'); window.open(d.verificationUri, '_blank', 'noopener');
      const poll = async () => { try { const p = await api('/api/github/star/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pollId: d.pollId }) }); if (p.body.starred) return finish(); if (p.body.error) throw Error(); timer.current = setTimeout(poll, Math.max(3, p.body.interval || d.interval || 5) * 1000); } catch { setPhase('ready'); setError(t('star.fail')); } };
      timer.current = setTimeout(poll, (d.interval || 5) * 1000);
    } catch { setError(t('star.fail')); }
  }
  const press = phase === 'manual' ? () => finish() : local && gh.signedIn ? starNow : local ? signIn : oauth;
  const label = phase === 'loading' ? t('star.checking') : local && gh.signedIn ? t('star.as', { user: gh.user }) : local ? t('star.signin') : '';
  return <>
    <button className={'star-btn ' + (phase === 'done' || phase === 'already' ? 'done' : '')} aria-label={t('star.aria')} onClick={press} disabled={['loading', 'working', 'code', 'done', 'already'].includes(phase)}>
      {phase === 'done' || phase === 'already' ? <Check size={56} /> : <Star size={56} fill="currentColor" />}
    </button>
    {label && phase !== 'done' && phase !== 'already' && <p className="star-as">{label}</p>}
    {phase === 'code' && code && <><p>{t('star.codeHelp')}</p><div className="star-code">{code.code || code.userCode}</div><p>{t('star.waiting')}</p></>}
    {phase === 'manual' && <p>{t('star.done')} ⭐</p>}
    {phase === 'done' && <p>{t('star.thanks')}</p>}{phase === 'already' && <p>{t('star.already')}</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}

/** Shown before the camera on the desktop web app until the repo is starred; "Later" skips it. */
export function StarGate({ onDone }) {
  useLang();
  return <div className="stargate" role="dialog" aria-label={t('star.title')}>
    <h1>{t('star.title')}</h1><p>{t('star.sub')}</p>
    <StarFlow onDone={onDone} />
    <button className="later" onClick={onDone}>{t('star.later')}</button>
  </div>;
}

/** The same star flow from Settings on any device, app included. */
export function StarSheet({ close }) {
  useLang();
  return <Sheet label={t('star.title')} onClose={close}><div className="star-sheet"><h2>{t('star.title')}</h2><p>{t('star.sub')}</p><StarFlow onDone={close} /></div></Sheet>;
}
