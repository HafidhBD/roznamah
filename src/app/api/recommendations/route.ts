import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recommend } from '@/lib/recommend';

const keys = z.array(z.string().min(1).max(64)).max(50);
const bodySchema = z.object({
  selections: z.object({
    sector: z.string().min(1).max(64).nullable(),
    fields: keys,
    audiences: keys,
    uses: keys,
  }),
  startMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/)
    .transform((s) => `${s.slice(0, 7)}-01`),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const items = await recommend(parsed.data.selections, parsed.data.startMonth);
  return NextResponse.json({ items });
}
