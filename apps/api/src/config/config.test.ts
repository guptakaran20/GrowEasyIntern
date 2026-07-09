import { describe, it, expect, vi, afterEach } from 'vitest';

describe('config batch concurrency', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults AI_CONCURRENCY to 1', async () => {
    vi.stubEnv('AI_CONCURRENCY', '');
    const { config } = await import('../config');
    expect(config.batch.concurrency).toBe(1);
  });

  it('reads AI_CONCURRENCY from environment', async () => {
    vi.stubEnv('AI_CONCURRENCY', '2');
    const { config } = await import('../config');
    expect(config.batch.concurrency).toBe(2);
  });
});
