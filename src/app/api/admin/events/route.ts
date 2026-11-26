import { adminRoute } from '@/lib/auth';
import { eventInputSchema } from '@/lib/admin/event-schema';
import { createEvent, isUniqueViolation } from '@/lib/admin/events';

export const POST = adminRoute(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  try {
    return Response.json({ id: await createEvent(parsed.data) }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return Response.json({ error: 'slug_taken' }, { status: 409 });
    }
    throw e;
  }
});
