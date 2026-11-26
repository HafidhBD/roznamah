import { adminRoute } from '@/lib/auth';
import { eventInputSchema } from '@/lib/admin/event-schema';
import { isForeignKeyViolation, isUuid, updateEvent } from '@/lib/admin/events';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute(async (req, { params }: Ctx) => {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: 'not_found' }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  try {
    const result = await updateEvent(id, parsed.data);
    if (result === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
    if (result === 'slug_immutable') return Response.json({ error: 'slug_immutable' }, { status: 400 });
  } catch (e) {
    if (isForeignKeyViolation(e)) return Response.json({ error: 'unknown_term' }, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true });
});
