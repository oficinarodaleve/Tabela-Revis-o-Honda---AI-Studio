import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { auth, googleAuthProvider } from '../../lib/firebase';
import { AdminUser } from '../../types';
import { adminFetch, clearAdminToken, setAdminToken } from '../../utils/adminAuth';

interface AdminLoginProps {
  onSuccess: (user: AdminUser) => void | Promise<void>;
  onBackToSite: () => void;
}

export function AdminLogin({ onSuccess, onBackToSite }: AdminLoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      setAdminToken(idToken);

      const res = await adminFetch('/api/auth/me');
      const data = (await res.json().catch(() => ({}))) as {
        user?: AdminUser;
        error?: string;
      };

      if (!res.ok || !data.user) {
        clearAdminToken();
        await signOut(auth).catch(() => {});
        setError(
          data.error ||
            'Esta conta Google não possui permissão de acesso ao painel administrativo.'
        );
        return;
      }

      await onSuccess(data.user);
    } catch (err) {
      clearAdminToken();
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Login cancelado. Selecione sua conta Google autorizada para continuar.');
      } else if (code === 'auth/popup-blocked') {
        setError(
          'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.'
        );
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Erro ao autenticar com o Google. Tente novamente.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="font-display text-2xl font-extrabold uppercase tracking-tight">
            <span className="text-neutral-900">RODALEVE </span>
            <span className="text-[#E4002B]">GESTOR</span>
          </p>
          <p className="mt-1.5 text-sm text-neutral-500">
            Acesso restrito a administradores autorizados
          </p>
        </div>

        <div className="mt-7 space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#E4002B]" />
              <p>
                Entre com sua conta Google administrativa autorizada para gerenciar tabelas de
                revisões, preços, modelos, SEO e integrações.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#E4002B]">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#E4002B] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            {loading ? 'Autenticando...' : 'Entrar com Google'}
          </button>
        </div>

        <button
          type="button"
          onClick={onBackToSite}
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para o site público
        </button>
      </div>
    </div>
  );
}
