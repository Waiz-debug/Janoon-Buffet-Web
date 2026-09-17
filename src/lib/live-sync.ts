import { supabase } from "@/lib/supabase";

/**
 * The app's single real-time sync engine.
 *
 * Previously every `useLiveTable` call opened its own Realtime channel and
 * fetched on its own: a dozen-plus subscriptions across the public site and the
 * two portals meant dozens of channels and the same table read repeatedly, and
 * a dropped socket went unnoticed until a hard reload. This module replaces
 * that with:
 *
 *   • ONE channel, bound to the whole `public` schema, so whichever tables the
 *     Postgres publication broadcasts are the ones that sync — a table added to
 *     the publication later starts working with no client change.
 *   • One shared cache per (table, variant), so the public menu and the admin
 *     menu each read their table once no matter how many components want it.
 *   • Coalesced refreshes, so a burst of writes is one read, not one per event.
 *   • Recovery: a reconnect, a network coming back or the tab regaining focus
 *     re-pulls every active snapshot, because the events sent while the socket
 *     was down are gone for good.
 */

type Entry = {
  table: string;
  rows: unknown[] | undefined;
  load: () => Promise<unknown[]>;
  listeners: Set<() => void>;
  fetching: boolean;
  /** A change arrived mid-fetch — read again once it settles. */
  dirty: boolean;
  /** Nobody is listening and the snapshot may be out of date. */
  stale: boolean;
};

/** Cache keyed by `table::variant` — see `useLiveTable`'s `key` argument. */
const entries = new Map<string, Entry>();
/** Tables with an unflushed change, coalesced into one read. */
const dirtyTables = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let channelStarted = false;
let everSubscribed = false;

export function liveCacheKey(table: string, variant: string): string {
  return `${table}::${variant}`;
}

function notify(entry: Entry) {
  for (const listener of entry.listeners) listener();
}

/** Read this entry's table and hand the new snapshot to its listeners. */
function refresh(entry: Entry) {
  if (entry.fetching) {
    entry.dirty = true;
    return;
  }
  entry.fetching = true;
  entry.stale = false;
  entry
    .load()
    .then((rows) => {
      entry.rows = rows;
      notify(entry);
    })
    .catch(() => {
      // Keep the last good snapshot on screen; a later subscriber retries.
      entry.stale = true;
    })
    .finally(() => {
      entry.fetching = false;
      if (entry.dirty) {
        entry.dirty = false;
        refresh(entry);
      }
    });
}

export function refreshAllLive() {
  for (const entry of entries.values()) refresh(entry);
}

/**
 * Re-read one cached entry now, whether or not anything reported a change.
 *
 * Used by the guest lookups, which poll. A guest has no SELECT policy on the
 * tables their own booking or order lives in — that is exactly what keeps other
 * customers' records off their screen — so Supabase sends them no Realtime
 * events for it, and a status changed at the desk would otherwise only appear
 * on their next reload.
 *
 * A no-op for a key nobody is subscribed to.
 */
export function refreshLive(key: string) {
  const entry = entries.get(key);
  if (entry) refresh(entry);
}

/** Collapse a burst of events on one table into a single read. */
function scheduleTableRefresh(table: string) {
  dirtyTables.add(table);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const tables = [...dirtyTables];
    dirtyTables.clear();
    for (const entry of entries.values()) {
      if (tables.includes(entry.table)) refresh(entry);
    }
  }, 120);
}

function startChannel() {
  if (channelStarted) return;
  channelStarted = true;

  supabase
    .channel("tribe-live")
    .on(
      "postgres_changes",
      // No `table` filter: the publication is the allow-list, so nothing the
      // database broadcasts can be missed by a stale client-side table list.
      { event: "*", schema: "public" },
      (payload) => {
        const table = (payload as { table?: string }).table;
        if (table) scheduleTableRefresh(table);
        else refreshAllLive();
      },
    )
    .subscribe((status: string) => {
      if (status !== "SUBSCRIBED") return;
      // Reconnect: whatever changed while the socket was down was never
      // delivered, so pull a fresh snapshot of everything in use.
      if (everSubscribed) refreshAllLive();
      everSubscribed = true;
    });

  const onVisible = () => {
    if (document.visibilityState === "visible") refreshAllLive();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", refreshAllLive);
}

/**
 * Subscribe to a cached live table. Returns the unsubscribe function, so it can
 * be handed straight to `useSyncExternalStore`.
 */
export function subscribeLive<T>(
  key: string,
  table: string,
  load: () => Promise<T[]>,
  onChange: () => void,
): () => void {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      table,
      rows: undefined,
      load: load as () => Promise<unknown[]>,
      listeners: new Set(),
      fetching: false,
      dirty: false,
      stale: true,
    };
    entries.set(key, entry);
  } else {
    // Every consumer of a key passes an equivalent reader; the newest wins.
    entry.load = load as () => Promise<unknown[]>;
    entry.table = table;
  }

  entry.listeners.add(onChange);
  startChannel();

  // First reader of this key, or the first after everyone unsubscribed: make
  // sure the snapshot is current rather than serving whatever was cached.
  if (!entry.fetching && (entry.rows === undefined || entry.stale)) {
    refresh(entry);
  }

  return () => {
    entry.listeners.delete(onChange);
    if (entry.listeners.size === 0) entry.stale = true;
  };
}

/** The cached snapshot, stable between reads — what `getSnapshot` returns. */
export function getLiveRows<T>(key: string): T[] | undefined {
  return entries.get(key)?.rows as T[] | undefined;
}
