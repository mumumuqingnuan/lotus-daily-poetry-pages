import assert from 'node:assert/strict';
import test from 'node:test';
import { beijingDay, createDailyStore, storageKey } from '../src/lib/local-daily';
import { categories, type Category } from '../src/lib/oracle-types';
import { getAction, getPoem, poemIds } from '../src/lib/poetry';

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  denyRead = false;
  denyWrite = false;
  getItem(key: string) {
    if (this.denyRead) throw new Error('SecurityError');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.denyWrite) throw new Error('QuotaExceededError');
    this.values.set(key, value);
    this.writes += 1;
  }
}

function fixture(iso = '2026-09-25T04:00:00.000Z', storage = new MemoryStorage()) {
  let instant = new Date(iso);
  const now = () => new Date(instant);
  const store = createDailyStore({ storage, now });
  const start = (category: Category = '学习成长', question = '把这个问题慢慢想清楚') =>
    store.updateDaily({ action: 'start', day: beijingDay(now()), category, question });
  const draw = (progress: number) =>
    store.updateDaily({ action: 'draw', day: beijingDay(now()), progress });
  return { store, storage, now, start, draw, setTime: (value: string) => { instant = new Date(value); } };
}

test('Beijing day changes at 16:00 UTC regardless of a timestamp offset', () => {
  assert.equal(beijingDay(new Date('2026-09-25T15:59:59.999Z')), '2026-09-25');
  assert.equal(beijingDay(new Date('2026-09-25T16:00:00.000Z')), '2026-09-26');
  assert.equal(beijingDay(new Date('2026-09-25T09:00:00-07:00')), '2026-09-26');
  assert.equal(beijingDay(new Date('2026-12-31T16:00:00.000Z')), '2027-01-01');
  assert.equal(beijingDay(new Date('2028-02-28T16:00:00.000Z')), '2028-02-29');
});

test('a fresh browser reads without creating storage or a daily entry', () => {
  const f = fixture();
  assert.deepEqual(f.store.readDaily(), { day: '2026-09-25', record: null });
  assert.deepEqual(f.store.readHistory().history, []);
  assert.equal(f.storage.writes, 0);
});

test('the poem, reflection, and chosen category action unfold in three sequential steps', () => {
  const f = fixture();
  const begun = f.start().record!;
  assert.equal(begun.progress, 0);
  assert.equal(begun.poem, null);
  assert.equal(begun.reflection, null);
  assert.equal(begun.action, null);
  assert.throws(() => f.draw(1), /先完成当前/);
  assert.equal(f.store.readDaily().record?.progress, 0);
  const first = f.draw(0).record!;
  assert.ok(first.poem?.lines.length);
  assert.equal(first.reflection, null);
  assert.equal(first.action, null);
  const second = f.draw(1).record!;
  assert.equal(second.reflection, getPoem(first.poem!.id).reflection);
  assert.equal(second.action, null);
  const third = f.draw(2).record!;
  assert.equal(third.action, getAction(getPoem(first.poem!.id), '学习成长'));
  assert.equal(third.progress, 3);
  assert.deepEqual(third.poem, first.poem);
  assert.equal(f.store.readHistory().history?.[0].title, first.poem!.title);
});

test('refresh restores note, category, start time, revealed content and progress', () => {
  const f = fixture();
  f.start('人际相处', '   写下自己的真实感受   ');
  const saved = f.draw(0);
  const refreshed = createDailyStore({ storage: f.storage, now: f.now });
  assert.deepEqual(refreshed.readDaily(), saved);
  assert.equal(saved.record?.question, '写下自己的真实感受');
  assert.equal(saved.record?.category, '人际相处');
  assert.equal(saved.record?.startedAt, '2026-09-25T04:00:00.000Z');
  assert.equal(refreshed.updateDaily({ action: 'draw', day: saved.day, progress: 1 }).record?.progress, 2);
});

test('a date selects the same poem across browsers and category choices', () => {
  const a = fixture();
  const b = fixture('2026-09-25T15:59:00.000Z');
  a.start('工作推进', '甲');
  b.start('生活整理', '乙');
  assert.deepEqual(a.draw(0).record?.poem, b.draw(0).record?.poem);
  for (let progress = 1; progress <= 2; progress++) { a.draw(progress); b.draw(progress); }
  assert.notEqual(a.store.readDaily().record?.action, b.store.readDaily().record?.action);
});

test('repeated start and draw requests preserve the first note and do not skip pages', () => {
  const f = fixture();
  f.start('生活整理', '原来的手记');
  const first = f.draw(0);
  const writes = f.storage.writes;
  assert.deepEqual(f.start('方向选择', '不能覆盖'), first);
  assert.deepEqual(f.draw(0), first);
  assert.equal(f.storage.writes, writes);
  assert.equal(f.draw(1).record?.progress, 2);
  assert.equal(f.draw(0).record?.progress, 2);
  const completed = f.draw(2);
  assert.deepEqual(f.draw(2), completed);
  assert.equal(completed.record?.question, '原来的手记');
  assert.equal(completed.record?.category, '生活整理');
});

test('independent clients re-read saved progress before applying stale requests', () => {
  const f = fixture();
  const otherTab = createDailyStore({ storage: f.storage, now: f.now });
  f.start();
  assert.equal(otherTab.readDaily().record?.progress, 0);
  f.draw(0);
  const staleRetry = otherTab.updateDaily({ action: 'draw', day: '2026-09-25', progress: 0 });
  assert.equal(staleRetry.record?.progress, 1);
  assert.equal(f.store.readDaily().record?.progress, 1);
});

test('midnight creates a fresh day, rejects stale writes and keeps partial history readable', () => {
  const f = fixture('2026-09-25T15:59:59.999Z');
  f.start();
  const yesterday = f.draw(0).record;
  const raw = f.storage.getItem(storageKey);
  f.setTime('2026-09-25T16:00:00.000Z');
  assert.deepEqual(f.store.readDaily(), { day: '2026-09-26', record: null });
  assert.throws(() => f.store.updateDaily({ action: 'draw', day: '2026-09-25', progress: 1 }), /新的一天/);
  assert.equal(f.storage.getItem(storageKey), raw);
  assert.deepEqual(f.store.readDaily('2026-09-25'), { day: '2026-09-26', record: yesterday });
  f.start('方向选择', '新的一天');
  const history = f.store.readHistory().history!;
  assert.deepEqual(history.map(row => [row.day, row.progress]), [['2026-09-26', 0], ['2026-09-25', 1]]);
  assert.equal(history[1].question, yesterday?.question);
});

test('all 24 source poems and six category actions remain available; history has no 60 entry cap', () => {
  assert.equal(poemIds.length, 24);
  assert.equal(new Set(poemIds).size, 24);
  for (const id of poemIds) {
    const poem = getPoem(id);
    assert.ok(poem.title && poem.lines.length && poem.reflection && poem.reading && poem.source);
    for (const category of categories) assert.ok(getAction(poem, category));
  }
  const f = fixture();
  const encountered = new Set<number>();
  for (let i = 0; i < 366; i++) {
    f.setTime(new Date(Date.UTC(2026, 0, 1 + i, 4)).toISOString());
    f.start();
    encountered.add(f.draw(0).record!.poem!.id);
  }
  assert.equal(encountered.size, 24);
  assert.equal(f.store.readHistory().history?.length, 366);
});

test('uses only its dedicated storage key and never imports other apps or accounts', () => {
  const f = fixture();
  f.storage.values.set('guanyin-lotus', 'keep-original');
  f.storage.values.set('daily-poetry', 'keep-other-site');
  assert.equal(f.store.readDaily().record, null);
  f.start();
  f.draw(0);
  assert.match(storageKey, /^lotus-daily-poetry-pages:v1:/);
  assert.deepEqual([...f.storage.values.keys()].sort(), ['daily-poetry', 'guanyin-lotus', storageKey].sort());
  assert.equal(f.storage.values.get('guanyin-lotus'), 'keep-original');
  assert.equal(f.storage.values.get('daily-poetry'), 'keep-other-site');
});

test('malformed JSON, schema versions and invalid rows are surfaced without overwriting bytes', () => {
  const f = fixture();
  f.start();
  const good = JSON.parse(f.storage.getItem(storageKey)!);
  const original = good.records[0];
  const variants = [
    '{bad json', '', 'null', '[]', '{}',
    JSON.stringify({ version: 2, records: [] }),
    JSON.stringify({ version: 1, records: {} }),
    ...[
      { progress: 4 }, { progress: -1 }, { progress: 0.5 },
      { category: '不存在' }, { poemId: 9999 }, { day: '2026-02-30' },
      { question: 'a'.repeat(121) }, { startedAt: 'yesterday' }, { startedAt: '2026-09-24T04:00:00.000Z' },
    ].map(change => JSON.stringify({ version: 1, records: [{ ...original, ...change }] })),
    JSON.stringify({ version: 1, records: [original, original] }),
  ];
  for (const raw of variants) {
    f.storage.values.set(storageKey, raw);
    const writes = f.storage.writes;
    assert.throws(() => f.store.readDaily(), /存档格式异常/);
    assert.throws(() => f.store.readHistory(), /存档格式异常/);
    assert.throws(() => f.start(), /存档格式异常/);
    assert.equal(f.storage.getItem(storageKey), raw);
    assert.equal(f.storage.writes, writes);
  }
});

test('quota or denied storage leaves saved progress intact and supports a later retry', () => {
  const f = fixture();
  f.start();
  const raw = f.storage.getItem(storageKey);
  f.storage.denyWrite = true;
  assert.throws(() => f.draw(0), /未能保存这一步/);
  assert.equal(f.storage.getItem(storageKey), raw);
  assert.equal(f.store.readDaily().record?.progress, 0);
  f.storage.denyWrite = false;
  assert.equal(f.draw(0).record?.progress, 1);
  f.storage.denyRead = true;
  assert.throws(() => f.store.readDaily(), /无法读取当前浏览器/);
  assert.throws(() => f.start(), /无法读取当前浏览器/);
  const denied = createDailyStore({ storage: () => { throw new Error('SecurityError'); } });
  assert.throws(() => denied.readDaily(), /无法读取当前浏览器/);
});

test('invalid selection, notes and out-of-order operations never create or change an entry', () => {
  const f = fixture();
  assert.throws(() => f.store.readDaily('2026-02-30'), /请选择/);
  assert.throws(() => f.store.readDaily('2026-09-26'), /请选择/);
  assert.throws(() => f.store.readDaily('../2026-09-25'), /请选择/);
  assert.throws(() => f.draw(0), /请先选择主题/);
  assert.throws(() => f.start('随心一读', 'a'.repeat(121)), /120字/);
  assert.throws(() => f.start('不存在' as Category), /请选择今天想看的主题/);
  assert.equal(f.storage.writes, 0);
  f.start();
  for (const progress of [-1, 0.5, 3, NaN, undefined]) {
    assert.throws(() => f.store.updateDaily({ action: 'draw', day: '2026-09-25', progress }), /依次展开/);
  }
  assert.equal(f.store.readDaily().record?.progress, 0);
});

test('returned poem lines and history objects cannot alter later reads', () => {
  const f = fixture();
  f.start();
  const response = f.draw(0);
  const originalLines = [...response.record!.poem!.lines];
  response.record!.poem!.lines[0] = 'changed';
  response.record!.question = 'changed';
  f.store.readHistory().history![0].question = 'changed';
  assert.deepEqual(f.store.readDaily().record?.poem?.lines, originalLines);
  assert.equal(f.store.readDaily().record?.question, '把这个问题慢慢想清楚');
});
