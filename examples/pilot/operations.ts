/** A deliberately local substitute for the application's backend, not an analytics transport. */
export function updateFavorite(nextFavorite: boolean, { fail, signal }: { fail: boolean; signal: AbortSignal }): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Operation cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      if (fail) reject(new Error('Локальная имитация отказа сервера'));
      else resolve(nextFavorite);
    }, 450);
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
  });
}
