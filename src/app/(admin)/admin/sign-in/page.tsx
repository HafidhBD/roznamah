import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import { t } from '@/i18n/core';

async function requestLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim();
  const callbackUrl = String(formData.get('callbackUrl') ?? '/admin');
  const redirectTo = callbackUrl.startsWith('/admin') ? callbackUrl : '/admin';
  try {
    // Same answer for admins and non-admins, so the page never reveals who is authorized.
    await signIn('resend', { email, redirectTo, redirect: false });
  } catch (e) {
    // Refused (not an admin) looks exactly like success; only real failures show an error.
    if (!(e instanceof AuthError && e.type === 'AccessDenied')) redirect('/admin/sign-in?error=1');
  }
  redirect('/admin/sign-in?sent=1');
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string }>;
}) {
  const { sent, error, callbackUrl } = await searchParams;
  return (
    <main className="mx-auto mt-20 max-w-sm px-4">
      <div className="rounded-xl border border-line bg-surface p-6">
        <h1 className="mb-1 text-xl font-semibold text-brand">{t('ar', 'admin.signin.title')}</h1>
        {sent ? (
          <p data-testid="signin-sent" className="mt-4 text-sm">
            {t('ar', 'admin.signin.sent')}
          </p>
        ) : (
          <form action={requestLink} className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted">{t('ar', 'admin.signin.hint')}</p>
            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {t('ar', 'admin.signin.error')}
              </p>
            ) : null}
            <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/admin'} />
            <label className="flex flex-col gap-1 text-sm">
              {t('ar', 'admin.signin.email')}
              <input
                type="email"
                name="email"
                required
                dir="ltr"
                autoComplete="email"
                className="rounded-lg border border-line px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">
              {t('ar', 'admin.signin.submit')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
