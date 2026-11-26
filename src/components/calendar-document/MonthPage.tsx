import type { SnapshotMonth } from '@/lib/snapshot-core';
import { templates } from './templates';
import type { DocContext } from './primitives';

export function MonthPage({ ctx, month, index }: { ctx: DocContext; month: SnapshotMonth; index: number }) {
  const { Month } = templates[ctx.design.template] ?? templates.modern;
  return <Month ctx={ctx} month={month} index={index} />;
}
