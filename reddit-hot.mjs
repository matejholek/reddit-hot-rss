#!/usr/bin/env node
// reddit-hot-rss: read the hottest posts of a subreddit from its public Atom feed and write them to JSON.
//
//   node reddit-hot.mjs ClaudeCode                       print the top 6 as JSON
//   node reddit-hot.mjs ClaudeCode --top 10 --out hot.json
//   REDDIT_CONTACT="you@example.com" node reddit-hot.mjs ClaudeCode
//
// Why RSS: Reddit's JSON API answers 403 to unregistered clients, the public feed does not.
// Politeness: one request per run, a descriptive User-Agent, Retry-After is honoured.
// Stored per post: id, title, link, post date. No author names, no post text. Titles and links belong to their authors.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SKIP_TITLE = /megathread|^\s*\[?(announcement|mod post|weekly|monthly)\b/i;   // pinned-style threads are not "hot posts"

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return entities[e.toLowerCase()] ?? m;
});
const pick = (xml, re) => { const m = xml.match(re); return m ? m[1] : ''; };

export function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const title = decode(pick(e, /<title[^>]*>([\s\S]*?)<\/title>/)).replace(/\s+/g, ' ').trim();
    const url = decode(pick(e, /<link[^>]*\shref="([^"]+)"/));
    const published = pick(e, /<published>([^<]+)<\/published>/) || pick(e, /<updated>([^<]+)<\/updated>/);
    const id = pick(e, /<id>([^<]+)<\/id>/).replace(/^t3_/, '');
    return { id, title, url, published };
  }).filter((p) => p.title && /^https:\/\/(www\.)?reddit\.com\/r\//.test(p.url) && p.published);
}

export function pickTop(posts, top = 6) {
  const seen = new Set();
  return posts.filter((p) => !SKIP_TITLE.test(p.title) && !seen.has(p.url) && seen.add(p.url)).slice(0, top).map((p, i) => ({ rank: i + 1, ...p }));
}

export async function fetchFeed(subreddit, { contact = '' } = {}) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot/.rss?limit=25`;
  const userAgent = `reddit-hot-rss/1.0 (reads one public RSS feed per run${contact ? `; contact ${contact}` : ''})`;
  const waits = [20, 45, 90];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/atom+xml' }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (res && res.ok) return res.text();
    const status = res ? res.status : 'network error';
    if (attempt >= waits.length || (res && ![429, 500, 502, 503, 504].includes(res.status))) throw new Error(`Reddit answered ${status}`);
    const retryAfter = res ? Number(res.headers.get('retry-after')) : NaN;
    const wait = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : waits[attempt], 120);
    console.error(`Reddit answered ${status}; waiting ${wait}s (attempt ${attempt + 2} of ${waits.length + 1})`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const subreddit = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!subreddit) { console.error('Usage: node reddit-hot.mjs <subreddit> [--top N] [--out file.json]'); process.exit(1); }
  const top = Number(flag('--top') ?? 6);
  const posts = pickTop(parseFeed(await fetchFeed(subreddit, { contact: process.env.REDDIT_CONTACT })), top);
  const snapshot = { subreddit, source: 'public RSS feed', fetchedAt: new Date().toISOString(), posts };
  const json = JSON.stringify(snapshot, null, 2) + '\n';
  const out = flag('--out');
  if (out) { writeFileSync(out, json); console.error(`saved ${posts.length} posts to ${out}`); } else process.stdout.write(json);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main().catch((e) => { console.error(e.message); process.exit(1); });
