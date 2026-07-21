/* PWA mode — anonymous auth. Telegram login removed. */
export async function loginWithTelegram(): Promise<{ userId: number; token: string; isNew: boolean; provider: string; telegramId: string }> {
  throw new Error('Telegram login not available in PWA mode. Use anonymous auth.');
}
