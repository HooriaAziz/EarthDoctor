import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Small keyed cache for remote datasets. Entries survive tab switches and
// remounts, so a dataset is fetched once per key (or again after maxAgeMs).

const store = new Map();
const listeners = new Set();
const IDLE = { status: "idle", data: null, error: null };

function setEntry(key, entry) {
  store.set(key, entry);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readRemote(key) {
  return store.get(key) || IDLE;
}

export function useRemote(key, loader, { enabled = true, maxAgeMs = Infinity } = {}) {
  const entry = useSyncExternalStore(subscribe, () => (key && store.get(key)) || IDLE);
  const loaderRef = useRef(loader);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (!enabled || !key) return undefined;

    const current = store.get(key);
    if (current?.status === "loading") return undefined;
    if (current?.status === "loaded" && Date.now() - current.at < maxAgeMs) return undefined;

    const controller = new AbortController();
    // Each request owns a token; a late-settling stale request must never
    // overwrite or delete the entry of a newer one.
    const token = Symbol(key);
    const owns = () => store.get(key)?.token === token;
    setEntry(key, { status: "loading", data: current?.data ?? null, error: null, token });

    loaderRef.current(controller.signal).then(
      (data) => {
        if (owns()) setEntry(key, { status: "loaded", data, error: null, at: Date.now(), token });
      },
      (error) => {
        if (!owns()) return;
        if (error?.name === "AbortError") {
          store.delete(key);
          listeners.forEach((listener) => listener());
          return;
        }
        setEntry(key, {
          token,
          status: "error",
          data: current?.data ?? null,
          error: error?.message || "Request failed",
        });
      }
    );

    return () => {
      controller.abort();
      // Release an in-flight entry immediately, so a remount (or React
      // StrictMode's re-run) starts a fresh request instead of waiting on
      // the aborted one.
      if (owns() && store.get(key).status === "loading") {
        const data = store.get(key).data;
        if (data != null) store.set(key, { status: "idle", data, error: null });
        else store.delete(key);
        listeners.forEach((listener) => listener());
      }
    };
  }, [key, enabled, maxAgeMs, nonce]);

  return {
    ...entry,
    reload: () => {
      if (key) store.delete(key);
      setNonce((value) => value + 1);
    },
  };
}
