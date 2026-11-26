'use client';

import { useCallback, useState } from 'react';
import type { CalendarEventView } from '@/lib/draft';

export type CustomPayload = { titleAr: string; titleEn?: string; date: string; color?: string };
export type DraftAction = 'add' | 'remove';
export type CustomResult = { ok: true } | { ok: false; error: string };

/** Client state for the events in the visitor's draft calendar. */
export function useDraftEvents(initial: CalendarEventView[]) {
  const [events, setEvents] = useState(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  /** Last failed action, so a page can show feedback; the plan builder ignores it. */
  const [failure, setFailure] = useState<DraftAction | null>(null);

  const rowIdByEvent = new Map(events.flatMap((e) => (e.eventId ? [[e.eventId, e.id] as const] : [])));
  const has = (eventId: string) => rowIdByEvent.has(eventId);

  const mark = (ids: string[], on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  const add = useCallback(async (eventIds: string[]) => {
    if (!eventIds.length) return;
    mark(eventIds, true);
    setFailure(null);
    try {
      const res = await fetch('/api/draft/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventIds }),
      });
      if (res.ok) setEvents((await res.json()).events);
      else setFailure('add');
    } catch {
      setFailure('add');
    } finally {
      mark(eventIds, false);
    }
  }, []);

  /** Adds a custom occasion; the API's error code is returned for inline display. */
  const addCustom = useCallback(async (custom: CustomPayload): Promise<CustomResult> => {
    try {
      const res = await fetch('/api/draft/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ custom }),
      });
      if (res.ok) {
        setEvents((await res.json()).events);
        return { ok: true };
      }
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: typeof body.error === 'string' ? body.error : 'unknown' };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  /** Removes a draft row by its row id (custom occasions have no eventId). */
  const removeRow = useCallback(async (rowId: string) => {
    mark([rowId], true);
    setFailure(null);
    try {
      const res = await fetch(`/api/draft/events?id=${rowId}`, { method: 'DELETE' });
      if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== rowId));
      else setFailure('remove');
    } catch {
      setFailure('remove');
    } finally {
      mark([rowId], false);
    }
  }, []);

  const remove = useCallback(
    async (eventId: string) => {
      const rowId = rowIdByEvent.get(eventId);
      if (!rowId) return;
      mark([eventId], true);
      setFailure(null);
      try {
        const res = await fetch(`/api/draft/events?id=${rowId}`, { method: 'DELETE' });
        if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== rowId));
        else setFailure('remove');
      } catch {
        setFailure('remove');
      } finally {
        mark([eventId], false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events],
  );

  return {
    events,
    count: events.length,
    has,
    isBusy: (id: string) => busy.has(id),
    add,
    addCustom,
    remove,
    removeRow,
    failure,
    clearFailure: () => setFailure(null),
  };
}
