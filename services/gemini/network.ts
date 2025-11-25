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

  /**
   * Securely downloads media by proxying the request.
   */
  public async downloadSecurely(uri: string): Promise<string> {
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(uri)}`);
      if (!response.ok) throw new Error("Secure download failed");
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Secure download error", e);
      throw e;
    }
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
