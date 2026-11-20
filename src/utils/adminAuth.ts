import { auth } from '../lib/firebase';

// Token JWT do Firebase mantido exclusivamente em memória (nunca em localStorage/sessionStorage)
let memoryToken: string | null = null;

export function getAdminToken(): string | null {
  return memoryToken;
}

export function setAdminToken(token: string | null): void {
  memoryToken = token;
}

export function clearAdminToken(): void {
  memoryToken = null;
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  let token = memoryToken;
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
      memoryToken = token;
    } catch {
      // Mantém token atual em memória caso a atualização falhe
    }
  }

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
