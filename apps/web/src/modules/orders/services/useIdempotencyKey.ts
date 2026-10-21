import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'sarh_orders_draft_idempotency_key';

const read = (): string | null => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: fall back to an in-memory key.
    return null;
  }
};

const write = (key: string): void => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* non-fatal: the key still lives in component state for this page view */
  }
};

const clear = (): void => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Owns the idempotency key for an in-progress order (R2, client half).
 *
 * The key is minted once when the form opens and then held in sessionStorage,
 * so a page reload mid-submit resubmits under the SAME key and the server
 * replays the original order instead of creating a second one. Keeping it only
 * in component state — the limitation noted in the first draft of DECISIONS.md
 * — would mint a fresh key on reload and defeat the guarantee exactly when the
 * user is most likely to retry.
 *
 * The key is retired only after the server has confirmed the order (201 or
 * 200). A network error deliberately keeps it, so the retry is still a replay.
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState<string>(() => {
    const existing = read();
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    write(fresh);
    return fresh;
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  /** Call after a confirmed success, so the next order starts a new key. */
  const rotate = useCallback(() => {
    clear();
    const fresh = crypto.randomUUID();
    write(fresh);
    setKey(fresh);
  }, []);

  return { idempotencyKey: key, rotate };
}
