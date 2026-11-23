#!/usr/bin/env node
// One-time: opens a real Chrome window so YOU sign in to the shops/search engines you use (Google, Naver...).
// The session is saved locally to .howmuch/browser-state.json (git-ignored) and reused by the research agent,
// so searches run as your own browser session instead of an anonymous headless bot. Nothing is sent anywhere.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const file = process.env.HOWMUCH_BROWSER_STATE || '.howmuch/browser-state.json';
mkdirSync('.howmuch', { recursive: true });
const browser = await chromium.launch({ channel: process.env.HOWMUCH_BROWSER_CHANNEL || 'chrome', headless: false });
const ctx = await browser.newContext({ locale: 'ko-KR' });
const page = await ctx.newPage();
await page.goto('https://www.google.com/');
console.log('Chrome이 열렸습니다. Google/네이버 등에 로그인한 뒤 이 터미널에서 Enter를 누르세요.');
await new Promise(r => process.stdin.once('data', r));
await ctx.storageState({ path: file });
await browser.close();
console.log('saved', file);
