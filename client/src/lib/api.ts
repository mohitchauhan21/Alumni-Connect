/**
 * api.ts
 * Reusable API client for the P11 backend.
 * - Always includes credentials (sends HTTP-only cookie).
 * - Normalizes error responses.
 * - Never stores tokens in browser storage.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // always send the HTTP-only auth cookie
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const error = json?.error;
    throw new ApiError(
      error?.message ?? 'An unexpected error occurred.',
      res.status,
      error?.code ?? 'API_ERROR',
      error?.details
    );
  }

  return json as T;
}

// ── Auth endpoints ─────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'alumni' | 'alumni_officer' | 'placement_officer' | 'admin';
  accountStatus: 'active' | 'disabled' | 'suspended';
  createdAt: string;
}

interface AuthResponse {
  success: boolean;
  data: { user: PublicUser };
}

interface LogoutResponse {
  success: boolean;
  data: { message: string };
}

export async function apiRegister(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'alumni';
}): Promise<PublicUser> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function apiLogin(payload: { email: string; password: string }): Promise<PublicUser> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function apiLogout(): Promise<void> {
  await request<LogoutResponse>('/auth/logout', { method: 'POST' });
}

export async function apiGetMe(): Promise<PublicUser | null> {
  try {
    const res = await request<AuthResponse>('/auth/me');
    return res.data.user;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}
