import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendChatRequest, type ChatGatewayRequest } from '../../services/chatGateway';

const basePayload: ChatGatewayRequest = {
  messages: [{ role: 'user', content: 'Hello' }],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('chat gateway', () => {
  it('throws when base URL is not configured', async () => {
    await expect(
      sendChatRequest(basePayload, { baseUrl: undefined as unknown as string })
    ).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it('returns parsed response when request succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ reply: 'test-response', tokensUsed: 12 }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendChatRequest(basePayload, { baseUrl: 'https://api.test' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/chat',
      expect.objectContaining({ method: 'POST' })
    );
    expect(response.reply).toBe('test-response');
    expect(response.tokensUsed).toBe(12);
  });

  it('surfaces non-2xx responses with status text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendChatRequest(basePayload, { baseUrl: 'https://api.test' })
    ).rejects.toThrow('Chat request failed: 500 Server Error');
  });

  it('throws when reply field is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ tokensUsed: 5 }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendChatRequest(basePayload, { baseUrl: 'https://api.test' })
    ).rejects.toThrow(/reply/);
  });
});
