import { adminRoute } from '@/lib/auth';
import { allLeads, leadsWorkbook } from '@/lib/admin/leads';

export const dynamic = 'force-dynamic';

export const GET = adminRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const rows = await allLeads({
    sector: q.get('sector') || undefined,
    from: q.get('from') || undefined,
    to: q.get('to') || undefined,
  });
  const body = await leadsWorkbook(rows);
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="leads.xlsx"',
      'cache-control': 'no-store',
    },
  });
});
