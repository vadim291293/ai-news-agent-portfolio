import { parseFeed, validateDecisions, messageFor } from '../src/core.mjs';

// Entirely fictional fixture; no model, network request or Telegram delivery.
const xml = `<rss><channel><item>
<title>Demo AI tool adds subtitles</title>
<link>https://example.com/demo/subtitles?utm_source=fixture</link>
<description>Demo AI tool adds subtitles to short videos.</description>
</item></channel></rss>`;
const source = { id: 'demo', allowed_host: 'example.com', initialized: true };
const items = parseFeed(xml, source).map((item, index) => ({ ...item, id: `demo-${index}` }));
const fixture = JSON.stringify({ results: [{
  id: items[0].id, important: true, score: 8, duplicate_of: null,
  event_key: 'fictional-demo-subtitles',
  title: 'Учебный пример: субтитры к коротким видео',
  what: 'Вымышленный AI-инструмент добавил субтитры.',
  why: 'Так выглядит структура уведомления о новой функции.',
  action: 'Посмотрите код обработки и проверок.',
  evidence: 'Demo AI tool adds subtitles'
}] });
const [decision] = validateDecisions(fixture, items, []);
if (!decision.important) throw new Error('Demo fixture rejected');
console.log('УЧЕБНАЯ ДЕМОНСТРАЦИЯ. Вымышленная новость и заранее заданный ответ модели.\n');
console.log(messageFor({ ...items[0], decision }));
