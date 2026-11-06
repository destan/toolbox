import { afterEach, describe, expect, it, vi } from 'vitest';
import { ECHO_URL, fetchEchoedRequest, formatHeaders, parseEchoedRequest } from './browser-headers.service';

const echoBody = {
  method: 'GET',
  ip: '203.0.113.7',
  headers: { 'Accept': '*/*', 'User-Agent': 'test-agent' },
};

describe('browser-headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('parseEchoedRequest', () => {
    it('extracts the IP address and the headers in response order', () => {
      expect(parseEchoedRequest(echoBody)).toEqual({
        ip: '203.0.113.7',
        headers: [
          { name: 'Accept', value: '*/*' },
          { name: 'User-Agent', value: 'test-agent' },
        ],
      });
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['a missing IP address', { headers: {} }],
      ['missing headers', { ip: '203.0.113.7' }],
      ['headers that are an array', { ip: '203.0.113.7', headers: [] }],
    ])('rejects %s', (_, body) => {
      expect(() => parseEchoedRequest(body)).toThrow('Beeceptor returned an unexpected response.');
    });
  });

  describe('fetchEchoedRequest', () => {
    it('omits credentials and the referrer from the request', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(echoBody)));
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchEchoedRequest()).resolves.toMatchObject({ ip: '203.0.113.7' });

      expect(fetchMock).toHaveBeenCalledWith(ECHO_URL, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
    });

    it('reports the HTTP status of a failed response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Too many requests', { status: 429 })));

      await expect(fetchEchoedRequest()).rejects.toThrow('Beeceptor responded with HTTP status 429.');
    });
  });

  describe('formatHeaders', () => {
    it('writes one header per line', () => {
      expect(formatHeaders([{ name: 'Accept', value: '*/*' }, { name: 'User-Agent', value: 'test-agent' }])).toBe('Accept: */*\nUser-Agent: test-agent');
    });
  });
});
