import { templates } from './templates';
import type { DocContext } from './primitives';

export function CoverPage({ ctx }: { ctx: DocContext }) {
  const { Cover } = templates[ctx.design.template] ?? templates.modern;
  return <Cover ctx={ctx} />;
}
