import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, initialState, makeMessages, byteLength, validateDecisions, digest } from '../src/core.mjs';

const source = { id: 'openai', allowed_host: 'openai.com', initialized: false };
const item = { id: 'one', source_id: 'openai', url: 'https://openai.com/news/new-model',
  title: 'Introducing a new model', excerpt: 'Introducing a new model with better tools.', attempts: 0 };
const decision = { id: 'one', important: true, score: 9, duplicate_of: null,
  event_key: 'openai-new-model', title: 'Вышла новая модель', what: 'Обновились инструменты.',
  why: 'Можно попробовать новые возможности.', action: 'Открой объявление.', evidence: 'Introducing a new model' };

test('RSS and Atom accept only source-owned HTTPS links and remove tracking', () => {
  const rss = `<rss><channel><item><title>Release &amp; tools</title><link>https://openai.com/news/new?utm_source=test</link><description><![CDATA[<p>New tools</p>]]></description><pubDate>Fri, 09 Oct 2026 17:00:00 GMT</pubDate></item><item><title>Bad</title><link>https://openai.com.evil.example/news</link></item></channel></rss>`;
  const entries = parseFeed(rss, source);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].url, 'https://openai.com/news/new');
  assert.equal(entries[0].title, 'Release & tools');
  assert.equal(entries[0].excerpt, 'New tools');
  const atom = `<feed><entry><title>Model</title><link rel="self" href="https://openai.com/feed/1"/><link rel="alternate" href="https://openai.com/news/model"/><summary>New model</summary></entry></feed>`;
  assert.equal(parseFeed(atom, source)[0].url, 'https://openai.com/news/model');
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY a "bad">]><rss/>', source));
});
test('first scan skips existing history, but accepts a release published after activation', () => {
  const now = Date.parse('2026-10-09T18:00:00Z');
  const started = '2026-10-09T17:00:00Z';
  assert.equal(initialState({ published_at: '2026-10-08T12:00:00Z' }, source, started, now), 'baseline');
  assert.equal(initialState({ published_at: '2026-10-09T17:30:00Z' }, source, started, now), 'pending');
  assert.equal(initialState({ published_at: null }, source, started, now), 'baseline');
  assert.equal(initialState({ published_at: '2026-10-01T12:00:00Z' }, { ...source, initialized: true }, started, now), 'skipped');
});
test('two large candidates stay inside the per-minute reservation allowance', () => {
  const items = [item, { ...item, id: 'two', title: 'Ж'.repeat(500), excerpt: 'Ж'.repeat(5000) }];
  const recent = Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: 'Ж'.repeat(500), event_key: 'past-event-' + i }));
  const messages = makeMessages(items, recent);
  const reserve = messages.reduce((sum, message) => sum + byteLength(message.content), 0) + 1600 + 256;
  assert.ok(reserve <= 7000);
});
test('unsupported assertions and invented evidence cannot produce alerts', () => {
  const valid = validateDecisions(JSON.stringify({ results: [decision] }), [item], []);
  assert.equal(valid[0].important, true);
  const invented = validateDecisions(JSON.stringify({ results: [{ ...decision, evidence: 'The model is free for everyone' }] }), [item], []);
  assert.equal(invented[0].important, false);
  assert.throws(() => validateDecisions(JSON.stringify({ results: [{ ...decision, id: 'invented' }] }), [item], []));
  const duplicate = validateDecisions(JSON.stringify({ results: [{ ...decision, duplicate_of: 'past' }] }), [item], [{ id: 'past' }]);
  assert.equal(duplicate[0].duplicate_of, 'past');
});
