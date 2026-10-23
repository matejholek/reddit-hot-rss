# reddit-hot-rss

Reads the hottest posts of a subreddit from its public Atom feed and writes them to JSON.

- No API key, no login, no dependencies. Node 20 or newer.
- Reddit's JSON API returns 403 to unregistered clients. The public RSS feed does not.
- One request per run, a descriptive User-Agent, and `Retry-After` is honoured.
- Stores id, title, link and post date only. No author names, no post text.

## Use

```bash
node reddit-hot.mjs ClaudeCode                      # top 6 as JSON on stdout
node reddit-hot.mjs ClaudeCode --top 10 --out hot.json
REDDIT_CONTACT="you@example.com" node reddit-hot.mjs ClaudeCode
```

Set `REDDIT_CONTACT` to an address or URL where Reddit can reach you. It goes into the User-Agent.

Output:

```json
{
  "subreddit": "ClaudeCode",
  "source": "public RSS feed",
  "fetchedAt": "2026-10-23T20:00:00.000Z",
  "posts": [{ "rank": 1, "id": "abc123", "title": "...", "url": "https://www.reddit.com/r/...", "published": "..." }]
}
```

Pinned-style threads (megathread, announcement, weekly, monthly) and duplicates are skipped.

## Limits

- The feed has no scores or comment counts. You get rank, title, date and link.
- Run it on a schedule you would be comfortable defending to Reddit. Hourly is plenty.
- Titles and links belong to their authors. Check Reddit's terms before you republish them.

## Test

```bash
npm test
```

## Licence

MIT, see [LICENSE](LICENSE). Fork it.
