import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, pickTop, decode } from '../reddit-hot.mjs';

const entry = (id, title, published = '2026-10-09T10:00:00+00:00') => `<entry><author><name>/u/someone</name><uri>https://www.reddit.com/user/someone</uri></author>
<category term="Example" label="r/Example"/><content type="html">&lt;p&gt;body text&lt;/p&gt;</content><id>t3_${id}</id>
<link href="https://www.reddit.com/r/Example/comments/${id}/slug/"/><updated>${published}</updated><published>${published}</published>
<title>${title}</title></entry>`;
const feed = (...e) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${e.join('')}</feed>`;

test('decodes named and numeric entities', () => {
  assert.equal(decode('Tom &amp; Jerry &#39;s &quot;x&quot; &#x1F600; &unknown;'), `Tom & Jerry 's "x" \u{1F600} &unknown;`);
});

test('parses id, title, link and date; keeps no author and no text', () => {
  const [p] = parseFeed(feed(entry('abc1', 'Me &amp; you: 5 tips')));
  assert.deepEqual(p, { id: 'abc1', title: 'Me & you: 5 tips', url: 'https://www.reddit.com/r/Example/comments/abc1/slug/', published: '2026-10-09T10:00:00+00:00' });
  assert.equal(JSON.stringify(p).includes('someone'), false);
  assert.equal(JSON.stringify(p).includes('body text'), false);
});

test('ignores entries without a Reddit link', () => {
  const bad = `<entry><id>t3_x</id><link href="https://example.com/x"/><published>2026-10-09T10:00:00+00:00</published><title>Elsewhere</title></entry>`;
  assert.deepEqual(parseFeed(feed(bad)), []);
});

test('picks the top N, skips megathreads and duplicates, numbers them', () => {
  const posts = parseFeed(feed(entry('a1', 'Megathread: weekly questions'), ...['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'].map((id, i) => entry(id, `Post ${i + 1}`)), entry('b2', 'Post 1 again')));
  const top = pickTop(posts);
  assert.deepEqual(top.map((p) => p.rank), [1, 2, 3, 4, 5, 6]);
  assert.equal(top[0].title, 'Post 1');
  assert.equal(pickTop(posts, 3).length, 3);
});
