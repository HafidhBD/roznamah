import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxonomyTerms } from '@/db/schema';
import { adminRoute } from '@/lib/auth';
import { taxonomyPatchSchema } from '@/lib/admin/event-schema';

// Terms are never deleted, only deactivated (active=false).
export const PATCH = adminRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: 'not_found' }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = taxonomyPatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const updated = await db.update(taxonomyTerms).set(parsed.data).where(eq(taxonomyTerms.id, id)).returning({ id: taxonomyTerms.id });
  if (!updated.length) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ ok: true });
});
