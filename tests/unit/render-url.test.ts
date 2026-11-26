import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT as format } from '@/lib/print-sizes';
import { printUrl } from '@/lib/render/pdf';


afterEach(() => vi.unstubAllEnvs());

describe('printUrl', () => {
  it('uses RENDER_BASE_URL (internal origin) when set, so the secret never goes through the public URL', () => {
    vi.stubEnv('RENDER_SECRET', 's3cret');
    vi.stubEnv('APP_URL', 'https://public.example');
    vi.stubEnv('RENDER_BASE_URL', 'http://app:3000/');
    const url = new URL(printUrl('abc', format));
    expect(url.origin).toBe('http://app:3000');
    expect(url.pathname).toBe('/print/abc');
    expect(url.searchParams.get('key')).toBe('s3cret');
  });

  it('falls back to APP_URL', () => {
    vi.stubEnv('RENDER_SECRET', 's3cret');
    vi.stubEnv('APP_URL', 'https://public.example');
    vi.stubEnv('RENDER_BASE_URL', '');
    expect(new URL(printUrl('abc', format)).origin).toBe('https://public.example');
  });
});
