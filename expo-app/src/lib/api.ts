export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export function normalizeServer(value: string, development: boolean): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new ApiError('Enter a valid server address.'); }
  if (!url.hostname || url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(development && url.protocol === 'http:'))) {
    throw new ApiError(development ? 'Use a valid HTTP or HTTPS server address.' : 'Use a secure HTTPS server address.');
  }
  return url.toString().replace(/\/+$/, '');
}

export class Api {
  token: string | null = null;
  onUnauthorized?: () => void;
  constructor(public readonly baseUrl: string) {}

  async call<T>(path: string, method = 'GET', data?: object, raw = false): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      const text = await response.text();
      if (!response.ok) {
        let message = `Request failed (${response.status}). Please retry.`;
        try { message = JSON.parse(text).error || message; } catch {}
        if (response.status === 401 && this.token) { this.token = null; this.onUnauthorized?.(); }
        throw new ApiError(message, response.status);
      }
      if (raw) return text as T;
      try { return JSON.parse(text) as T; } catch { throw new ApiError('Unexpected response from the server.'); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The server took too long. Check your connection and retry.' : 'Cannot reach the server. Check its address and your connection.');
    } finally { clearTimeout(timer); }
  }
}
