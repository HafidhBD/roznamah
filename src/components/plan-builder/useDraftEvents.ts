'use client';

import { useCallback, useState } from 'react';
import type { CalendarEventView } from '@/lib/draft';

/** Client state for the events in the visitor's draft calendar. */
export function useDraftEvents(initial: CalendarEventView[]) {
  const [events, setEvents] = useState(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());

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
    try {
      const res = await fetch('/api/draft/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventIds }),
      });
      if (res.ok) setEvents((await res.json()).events);
    } finally {
      mark(eventIds, false);
    }
  }, []);

  const remove = useCallback(
    async (eventId: string) => {
      const rowId = rowIdByEvent.get(eventId);
      if (!rowId) return;
      mark([eventId], true);
      try {
        const res = await fetch(`/api/draft/events?id=${rowId}`, { method: 'DELETE' });
        if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== rowId));
      } finally {
        mark([eventId], false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events],
  );

  return { events, count: events.length, has, isBusy: (id: string) => busy.has(id), add, remove };
}
