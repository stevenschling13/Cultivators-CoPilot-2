import { env } from '../config/env';
import { CalculatedMetrics, EnvironmentReading, GrowSetup } from '../types';

export interface GatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatGatewayRequest {
  messages: GatewayMessage[];
  environment?: Partial<EnvironmentReading> & { vpd?: CalculatedMetrics['vpd']; dli?: CalculatedMetrics['dli'] };
  setup?: Partial<GrowSetup>;
}

export interface ChatGatewayResponse {
  reply: string;
  tokensUsed?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

function buildUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/chat`;
}

export async function sendChatRequest(
  payload: ChatGatewayRequest,
  options?: { baseUrl?: string; timeoutMs?: number }
): Promise<ChatGatewayResponse> {
  const baseUrl = options?.baseUrl ?? env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ChatGatewayResponse;

    if (!data.reply) {
      throw new Error('Chat response missing required "reply" field');
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}
