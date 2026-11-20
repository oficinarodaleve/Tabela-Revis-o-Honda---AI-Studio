import React, { useState } from 'react';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { AdminUser } from '../../types';
import { setAdminToken } from '../../utils/adminAuth';

interface AdminLoginProps {
  onSuccess: (user: AdminUser) => void | Promise<void>;
  onBackToSite: () => void;
}

export function AdminLogin({ onSuccess, onBackToSite }: AdminLoginProps) {
  const [email, setEmail] = useState('lazarovictor.rodaleve@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Informe o e-mail e a senha de acesso.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'E-mail ou senha incorretos.');
        return;
      }
      if (data.token) {
        setAdminToken(data.token);
      }
      await onSuccess(data.user);
    } catch {
      setError('Erro de conexão com o servidor. Tente novamente.');
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

        <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">E-mail</label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@rodaleve.com.br"
                className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 focus:border-[#E4002B] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Senha</label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 focus:border-[#E4002B] focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#E4002B]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#E4002B] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar no Painel'}
          </button>
        </form>

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
