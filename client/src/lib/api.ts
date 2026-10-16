import type { SignInInput, SignUpInput, User, Category } from '../../../shared/contracts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}
function failureMessage(body: unknown): { code: string; message: string } | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const error = body.error;
  if (typeof error !== 'object' || error === null || !('message' in error) || !('code' in error))
    return null;
  return typeof error.message === 'string' && typeof error.code === 'string'
    ? { code: error.code, message: error.message }
    : null;
}
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'We could not reach Retain. Check your connection and try again.',
    );
  }
  if (response.status === 204) return undefined as T;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response. Please try again.',
    );
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('retain:session-expired'));
    const failure = failureMessage(body);
    throw new ApiError(
      response.status,
      failure?.code || 'REQUEST_FAILED',
      failure?.message || 'Something went wrong. Please try again.',
    );
  }
  return body as T;
}
export const authApi = {
  me: (signal?: AbortSignal) => apiRequest<{ user: User }>('/auth/me', { signal }),
  signIn: (input: SignInInput) =>
    apiRequest<{ user: User }>('/auth/signin', { method: 'POST', body: JSON.stringify(input) }),
  signUp: (input: SignUpInput) =>
    apiRequest<{ user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
  signOut: () => apiRequest<void>('/auth/signout', { method: 'POST' }),
};
export function getCategories(signal?: AbortSignal) {
  return apiRequest<{ categories: Category[] }>('/categories', { signal });
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
