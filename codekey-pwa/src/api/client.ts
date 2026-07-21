import { getUserToken } from '../auth/storage';
import { clearDeviceCredentials, getClientToken } from '../auth/device-storage';

export const AUTH_EXPIRED_EVENT = 'codekey:auth-expired';
export const CLIENT_TOKEN_INVALID_EVENT = 'codekey:client-token-invalid';

export class UnboundDeviceError extends Error {
  readonly code: 'client_token_required' | 'client_token_invalid';
  constructor(code: 'client_token_required' | 'client_token_invalid') {
    super(code);
    this.name = 'UnboundDeviceError';
    this.code = code;
  }
}

const API_BASE = 'http://146.56.247.15';

async function request<T>(path: string, init: RequestInit = {}, authToken?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  // Always send clientToken header if available (this is the real auth)
  const ct = getClientToken();
  if (ct) {
    headers.set('x-codekey-client-token', ct);
  }
  // Only send Authorization if we have a real token (not the "logged-in" dummy)
  if (authToken && authToken !== 'logged-in') {
    headers.set('authorization', 'Bearer ' + authToken);
  }

  var resp = await fetch(API_BASE + path, { ...init, headers, signal: AbortSignal.timeout(15000) });

  if (resp.status === 401) {
    var body: { error?: string } = {};
    try { body = await resp.clone().json() as { error?: string }; } catch (_e) { /* not JSON */ }
    if (body.error === 'client_token_invalid' || body.error === 'client_token_required') {
      clearDeviceCredentials();
      window.dispatchEvent(new Event(CLIENT_TOKEN_INVALID_EVENT));
      throw new UnboundDeviceError(body.error);
    }
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  if (!resp.ok) {
    var message = 'HTTP ' + resp.status;
    try { var b = (await resp.json()) as { error?: string }; message = b.error || message; } catch (_e) {}
    throw new Error(message);
  }

  return (await resp.json()) as T;
}

export function userRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init, getUserToken());
}

export function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init, null);
}
