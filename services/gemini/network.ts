import { GoogleGenAI } from "@google/genai";

const DEFAULT_API_BASE = "https://generativelanguage.googleapis.com";

const buildProxyEndpoint = (targetUrl: string): string => {
  const parsed = targetUrl.startsWith('http')
    ? new URL(targetUrl)
    : new URL(targetUrl, DEFAULT_API_BASE);

  parsed.searchParams.delete('key');
  const search = parsed.searchParams.toString();
  const endpointPath = `${parsed.pathname.replace(/^\//, '')}${search ? `?${search}` : ''}`;

  return `/api/proxy?endpoint=${encodeURIComponent(endpointPath)}`;
};

export const createProxyFetch = (): typeof fetch => {
  const nativeFetch = globalThis.fetch;

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL
      ? input.toString()
      : input.url;

    const requestInit: RequestInit = {
      method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
      headers: init?.headers ?? (input instanceof Request ? input.headers : undefined),
      body: init?.body ?? (input instanceof Request ? input.body : undefined),
      cache: init?.cache ?? (input instanceof Request ? input.cache : undefined),
      credentials: init?.credentials ?? (input instanceof Request ? input.credentials : undefined),
      integrity: init?.integrity ?? (input instanceof Request ? input.integrity : undefined),
      keepalive: init?.keepalive ?? (input instanceof Request ? input.keepalive : undefined),
      mode: init?.mode ?? (input instanceof Request ? input.mode : undefined),
      redirect: init?.redirect ?? (input instanceof Request ? input.redirect : undefined),
      referrer: init?.referrer ?? (input instanceof Request ? input.referrer : undefined),
      referrerPolicy: init?.referrerPolicy ?? (input instanceof Request ? input.referrerPolicy : undefined),
      signal: init?.signal ?? (input instanceof Request ? input.signal : undefined)
    };

    return nativeFetch(buildProxyEndpoint(url), requestInit);
  };
};

export const createProxyGoogleGenAI = (): GoogleGenAI =>
  new GoogleGenAI({ apiKey: 'proxy', baseUrl: DEFAULT_API_BASE, fetch: createProxyFetch() });

export class GeminiNetwork {
  /**
   * Helper to call the secure proxy
   */
  public async callProxy<T>(endpoint: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body && method === 'POST') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`/api/proxy?endpoint=${encodeURIComponent(endpoint)}`, options);

    if (!response.ok) {
      throw new Error(`Proxy Error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  public async fetchBlobViaProxy(uri: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(uri)}`);
      if (!response.ok) throw new Error("Secure download failed");
      return response.blob();
    } catch (e) {
      console.error("Secure download error", e);
      throw e;
    }
  }

  /**
   * Securely downloads media by proxying the request.
   */
  public async downloadSecurely(uri: string): Promise<string> {
    const blob = await this.fetchBlobViaProxy(uri);
    return URL.createObjectURL(blob);
  }

  // --- Utilities ---
  
  public arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
          };
          reader.readAsDataURL(blob);
      });
  }
}
