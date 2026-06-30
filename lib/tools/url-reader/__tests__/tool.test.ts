import { beforeEach, describe, expect, it, vi } from 'vitest';
import urlReaderTool, { __setUrlReaderDnsLookupForTests } from '../index';

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: mocks.axiosGet,
  },
}));

interface RequestConfig {
  maxRedirects?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
  lookup?: (hostname: string, options: { all?: boolean }) => Promise<Array<{ address: string; family?: number }>>;
}

function htmlResponse(html: string, status = 200) {
  return {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    data: Buffer.from(html, 'utf-8'),
  };
}

const articleHtml = `
  <!doctype html>
  <html>
    <head><title>Ignored title</title><script>window.secret = true;</script></head>
    <body>
      <nav>This navigation should disappear completely from the readable result.</nav>
      <main>
        <h1>Important Article</h1>
        <p>This important article explains why direct URL reading is useful when the user has already provided a specific page to inspect.</p>
        <p>The extracted content should preserve useful article text while stripping scripts, navigation, and decorative chrome.</p>
      </main>
    </body>
  </html>
`;

describe('read_url tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setUrlReaderDnsLookupForTests(mocks.lookup);
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
    mocks.axiosGet.mockResolvedValue(htmlResponse(articleHtml));
  });

  it('reads one public URL through the real content service and disables redirects', async () => {
    const result = await urlReaderTool.execute({
      url: ' https://example.com/article ',
      maxCharacters: 5000,
    });

    expect(result).toMatchObject({
      status: 'completed',
      url: 'https://example.com/article',
      truncated: false,
    });
    expect((result as { content: string }).content).toContain('Important Article');
    expect((result as { content: string }).content).toContain('direct URL reading is useful');
    expect((result as { content: string }).content).not.toContain('window.secret');
    expect((result as { content: string }).content).not.toContain('navigation should disappear');
    expect(mocks.lookup).toHaveBeenCalledWith('example.com', { all: true });
    expect(mocks.axiosGet).toHaveBeenCalledWith(
      'https://example.com/article',
      expect.objectContaining({
        maxRedirects: 0,
        maxContentLength: 1_000_000,
        maxBodyLength: 1_000_000,
        lookup: expect.any(Function),
      }),
    );
  });

  it('pins the validated public address into the actual request lookup', async () => {
    mocks.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    mocks.axiosGet.mockImplementationOnce(async (_url: string, config: RequestConfig) => {
      mocks.lookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);

      await expect(config.lookup?.('example.com', { all: true })).resolves.toEqual([
        { address: '93.184.216.34', family: 4 },
      ]);
      await expect(config.lookup?.('other.example.com', { all: true })).rejects.toThrow(/unexpected host/);

      return htmlResponse(articleHtml);
    });

    const result = await urlReaderTool.execute({
      url: 'https://example.com/rebinding-attempt',
    });

    expect((result as { content: string }).content).toContain('Important Article');
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });

  it('rejects private URL literals before DNS lookup or fetch', async () => {
    await expect(
      urlReaderTool.execute({ url: 'http://127.0.0.1:54321/admin' }),
    ).rejects.toThrow(/UrlReader.*not allowed|UrlReader.*internal\/private/);

    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it('rejects non-http schemes and private IPv6 literals before DNS lookup or fetch', async () => {
    for (const url of [
      'file:///etc/passwd',
      'gopher://example.com/',
      'http://[::1]/admin',
    ]) {
      await expect(urlReaderTool.execute({ url })).rejects.toThrow(/UrlReader.*http\(s\)|UrlReader.*not allowed/);
    }

    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it('rejects public hostnames that resolve to private addresses before fetch', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.1.2.3' }]);

    await expect(
      urlReaderTool.execute({ url: 'https://example.com/private-by-dns' }),
    ).rejects.toThrow(/UrlReader.*non-public address/);

    expect(mocks.lookup).toHaveBeenCalledWith('example.com', { all: true });
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it('does not follow redirects while reading user-supplied URLs', async () => {
    mocks.axiosGet.mockResolvedValueOnce({
      status: 302,
      headers: {
        location: 'http://169.254.169.254/latest/meta-data',
        'content-type': 'text/html; charset=utf-8',
      },
      data: Buffer.from('', 'utf-8'),
    });

    await expect(
      urlReaderTool.execute({ url: 'https://example.com/redirect' }),
    ).rejects.toThrow(/Redirect responses are not followed/);

    expect(mocks.axiosGet).toHaveBeenCalledWith(
      'https://example.com/redirect',
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });

  it('rejects non-html content on user-supplied URL reads', async () => {
    mocks.axiosGet.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: Buffer.from('{"secret":true}', 'utf-8'),
    });

    await expect(
      urlReaderTool.execute({ url: 'https://example.com/data.json' }),
    ).rejects.toThrow(/Unsupported content type/);
  });

  it('bounds returned content and reports truncation', async () => {
    const longParagraph = `Important Article ${'useful content '.repeat(2000)}`;
    mocks.axiosGet.mockResolvedValueOnce(htmlResponse(`<main><p>${longParagraph}</p></main>`));

    const result = await urlReaderTool.execute({
      url: 'https://example.com/long',
      maxCharacters: 1200,
    }) as { content: string; returnedLength: number; contentLength: number; truncated: boolean };

    expect(result.truncated).toBe(true);
    expect(result.returnedLength).toBeLessThanOrEqual(1200);
    expect(result.contentLength).toBeGreaterThan(result.returnedLength);
    expect(result.content).toContain('Important Article');
  });

  it('reports truncation against the original cleaned page length', async () => {
    const longParagraph = `Important Article ${'full page content '.repeat(3000)}`;
    mocks.axiosGet.mockResolvedValueOnce(htmlResponse(`<main><p>${longParagraph}</p></main>`));

    const result = await urlReaderTool.execute({
      url: 'https://example.com/service-truncated',
      maxCharacters: 15000,
    }) as { returnedLength: number; contentLength: number; truncated: boolean };

    expect(result.truncated).toBe(true);
    expect(result.returnedLength).toBeLessThanOrEqual(15000);
    expect(result.contentLength).toBeGreaterThan(result.returnedLength);
  });
});
