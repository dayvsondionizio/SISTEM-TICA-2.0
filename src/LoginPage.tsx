import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError('E-mail ou senha inválidos.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#001F3F] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F5C000] mb-4">
            <ShieldCheck className="w-8 h-8 text-[#001F3F]" />
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">ECONOMIA ICMS</h1>
          <p className="text-white/40 text-sm mt-1">Sistemática 2.0</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-white/25 text-sm outline-none focus:border-[#F5C000]/60 focus:bg-white/15 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 pr-11 text-white placeholder:text-white/25 text-sm outline-none focus:border-[#F5C000]/60 focus:bg-white/15 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#F5C000] hover:bg-[#e6b000] disabled:opacity-50 text-[#001F3F] font-black text-sm rounded-xl px-4 py-3 transition-colors mt-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar
              </>
            )}
          </button>
        </form>

        <p className="text-center text-white/20 text-xs mt-6">
          Acesso restrito · Contador de Padarias
        </p>
      </div>
    </div>
  );
}
