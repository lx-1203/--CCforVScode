const TOKEN_KEY = 'XJ_CK_USER_TOKEN';

export function getUserToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setUserToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearUserToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
