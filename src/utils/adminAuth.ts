const STORAGE_KEY = 'rodaleve_gestor_token';

// Fallback em memória caso localStorage/sessionStorage/cookies sejam bloqueados no iframe/sandbox
let memoryToken: string | null = null;

export function getAdminToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const fromSession = window.sessionStorage?.getItem(STORAGE_KEY);
    if (fromSession) {
      memoryToken = fromSession;
      return fromSession;
    }
  } catch {
    // Ignorar erro de sandbox/iframe
  }
  try {
    const fromLocal = window.localStorage?.getItem(STORAGE_KEY);
    if (fromLocal) {
      memoryToken = fromLocal;
      return fromLocal;
    }
  } catch {
    // Ignorar erro de sandbox/iframe
  }
  return null;
}

export function setAdminToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      window.sessionStorage?.setItem(STORAGE_KEY, token);
    } else {
      window.sessionStorage?.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignorar erro de sandbox/iframe
  }
  try {
    if (token) {
      window.localStorage?.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage?.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignorar erro de sandbox/iframe
  }
}

export function clearAdminToken(): void {
  setAdminToken(null);
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
