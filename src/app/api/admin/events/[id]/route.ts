import { adminRoute } from '@/lib/auth';
import { eventInputSchema } from '@/lib/admin/event-schema';
import { isUniqueViolation, isUuid, updateEvent } from '@/lib/admin/events';

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
    if (!(await updateEvent(id, parsed.data))) return Response.json({ error: 'not_found' }, { status: 404 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return Response.json({ error: 'slug_taken' }, { status: 409 });
    }
    throw e;
  }
  return Response.json({ ok: true });
});
