import { afterEach, expect, it, vi } from 'vitest';
import { acquireLearningSessionLease } from './useLearningSessionLease';
afterEach(() => vi.unstubAllGlobals());
it('releases an already granted lock when cleanup runs before the acquisition promise handler', async () => {
 let held = false;
 vi.stubGlobal('navigator', { locks: { request: async (_name: string, options: { signal?: AbortSignal }, callback: (lock: object | null) => Promise<void>) => {
  expect(options).toEqual({ ifAvailable: true });
  // Browser lock requests and grants are tasks, including requests made during StrictMode replay.
  await new Promise(resolve => setTimeout(resolve, 0));
  if (options.signal?.aborted) throw new Error('aborted');
  if (held) return callback(null);
  held = true;
  try { await callback({}); } finally { held = false; }
 } } });
 const firstController = new AbortController();
 const first = acquireLearningSessionLease('child', firstController.signal);
 firstController.abort();
 const second = acquireLearningSessionLease('child');
 await expect(first).rejects.toThrow('learning-session-cancelled');
 const release = await second;
 expect(held).toBe(true);
 await expect(acquireLearningSessionLease('child')).rejects.toThrow('learning-session-active-elsewhere');
 release(); await Promise.resolve(); await Promise.resolve(); expect(held).toBe(false);
 const thirdController = new AbortController();
 await acquireLearningSessionLease('child', thirdController.signal);
 thirdController.abort();
 const fourth = await acquireLearningSessionLease('child'); fourth();
});
