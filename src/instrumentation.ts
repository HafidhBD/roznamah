/** Next.js boot hook: log configuration problems once when the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logConfigProblems } = await import('@/lib/config-check');
  logConfigProblems('app');
}
