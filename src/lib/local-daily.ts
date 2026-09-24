import { categories, type Category, type DailyRecord, type DailyResponse } from './oracle-types';
import { getAction, getPoem, poemIds } from './poetry';

/** Deliberately separate from every original Lotus application and other Pages app. */
export const storageKey = 'lotus-daily-poetry-pages:v1:daily-records';
const invalidArchive = '当前浏览器的诗笺存档格式异常，原记录已保留。请先备份浏览器数据，再尝试恢复。';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type StoredRecord = {
  day: string;
  startedAt: string;
  question: string;
  category: Category;
  poemId: number;
  progress: number;
};
type Archive = { version: 1; records: StoredRecord[] };
export type DailyUpdate = {
  action: 'start' | 'draw';
  day: string;
  question?: string;
  category?: Category;
  progress?: number;
};

/** UTC arithmetic avoids dependence on the device's configured time zone. */
export function beijingDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function validDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function validRecord(value: unknown): value is StoredRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return validDay(row.day)
    && typeof row.startedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.startedAt)
    && Number.isFinite(Date.parse(row.startedAt))
    && new Date(row.startedAt).toISOString() === row.startedAt
    && beijingDay(new Date(row.startedAt)) === row.day
    && typeof row.question === 'string' && row.question.length <= 120
    && categories.includes(row.category as Category)
    && Number.isInteger(row.poemId) && poemIds.includes(row.poemId as number)
    && Number.isInteger(row.progress) && Number(row.progress) >= 0 && Number(row.progress) <= 3;
}

/** Versioned deterministic selection: reopening or retrying never redraws a day. */
function poemForDay(day: string): number {
  let hash = 2166136261;
  for (const char of `lotus-daily-poetry-v1:${day}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return poemIds[(hash >>> 0) % poemIds.length];
}

function present(row: StoredRecord | undefined, day: string): DailyResponse {
  if (!row) return { day, record: null };
  const selected = getPoem(row.poemId);
  const { reflection, theme, ...poem } = selected;
  void theme;
  const record: DailyRecord = {
    day: row.day,
    startedAt: row.startedAt,
    question: row.question,
    category: row.category,
    progress: row.progress,
    // Copy the lines as well, so a consumer cannot mutate the bundled poetry.
    poem: row.progress >= 1 ? { ...poem, lines: [...poem.lines] } : null,
    reflection: row.progress >= 2 ? reflection : null,
    action: row.progress >= 3 ? getAction(selected, row.category) : null,
  };
  return { day, record };
}

/** Inject storage and clock for repeatable checks without touching real records. */
export function createDailyStore(options: {
  storage?: StorageLike | (() => StorageLike);
  now?: () => Date;
} = {}) {
  const now = options.now ?? (() => new Date());

  function storage(): StorageLike {
    return typeof options.storage === 'function'
      ? options.storage()
      : options.storage ?? globalThis.localStorage;
  }

  function load(): Archive {
    let raw: string | null;
    try {
      raw = storage().getItem(storageKey);
    } catch {
      throw new Error('无法读取当前浏览器的记录，请检查浏览器是否允许本站保存数据。');
    }
    if (raw === null) return { version: 1, records: [] };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(invalidArchive);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(invalidArchive);
    const archive = parsed as Partial<Archive>;
    if (archive.version !== 1 || !Array.isArray(archive.records)
      || !archive.records.every(validRecord)
      || new Set(archive.records.map(row => row.day)).size !== archive.records.length) {
      throw new Error(invalidArchive);
    }
    return archive as Archive;
  }

  function save(archive: Archive) {
    try {
      // One atomic localStorage write: quota failure leaves the previous value intact.
      storage().setItem(storageKey, JSON.stringify(archive));
    } catch {
      throw new Error('当前浏览器未能保存这一步，可能是存储空间不足或保存权限受限。请检查后重试，原记录会保留。');
    }
  }

  function readDaily(selectedDay?: string): DailyResponse {
    const day = beijingDay(now());
    const selected = selectedDay ?? day;
    if (!validDay(selected) || selected > day) throw new Error('请选择今天或已经保存的日期。');
    return present(load().records.find(row => row.day === selected), day);
  }

  function readHistory(): DailyResponse {
    const day = beijingDay(now());
    const history = load().records
      .slice()
      .sort((a, b) => b.day.localeCompare(a.day))
      .map(row => ({
        day: row.day,
        question: row.question,
        category: row.category,
        progress: row.progress,
        title: row.progress > 0 ? getPoem(row.poemId).title : '尚未展开',
        legacy: false,
      }));
    return { day, record: null, history };
  }

  function updateDaily(body: DailyUpdate): DailyResponse {
    const instant = now();
    const day = beijingDay(instant);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请从诗笺页面操作。');
    if (body.day !== day) throw new Error('新的一天开始了，请返回查看今日诗笺。');
    // Re-read before every mutation so retries and other tabs see the latest progress.
    const archive = load();
    let row = archive.records.find(record => record.day === day);
    if (body.action === 'start') {
      // A second start cannot change the note, category, poem, or start time.
      if (row) return present(row, day);
      if (body.question !== undefined && typeof body.question !== 'string') throw new Error('文字格式不正确。');
      const question = (body.question ?? '').trim();
      if (question.length > 120) throw new Error('文字请控制在120字以内。');
      if (!categories.includes(body.category as Category)) throw new Error('请选择今天想看的主题。');
      row = {
        day, startedAt: instant.toISOString(), question, category: body.category!,
        poemId: poemForDay(day), progress: 0,
      };
      archive.records.push(row);
    } else if (body.action === 'draw') {
      if (!row) throw new Error('请先选择主题，开始今日诗笺。');
      if (!Number.isInteger(body.progress) || Number(body.progress) < 0 || Number(body.progress) > 2) {
        throw new Error('请依次展开三张笺页。');
      }
      const requested = Number(body.progress);
      if (requested > row.progress) throw new Error('请先完成当前这一页。');
      // A retry from an already completed page is a successful read, not a new step.
      if (requested < row.progress) return present(row, day);
      row.progress += 1;
    } else {
      throw new Error('请从诗笺页面操作。');
    }
    save(archive);
    return present(row, day);
  }

  return { readDaily, readHistory, updateDaily };
}

const browserStore = createDailyStore();
export const readDaily = browserStore.readDaily;
export const readHistory = browserStore.readHistory;
export const updateDaily = browserStore.updateDaily;
