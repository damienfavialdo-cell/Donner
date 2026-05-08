import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { LogIn, Building2, Globe } from 'lucide-react';

export default function Auth() {
  const { signIn } = useAuth();
  const { t, lang, setLang, langNames, langs } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');

    if (!cleanEmail || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setSubmitting(true);

    try {
      const { error: err } = await signIn(cleanEmail, password);
      if (err) {
        setError(err);
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Globe className="w-4 h-4 text-slate-400" />
            <select
              value={lang}
              onChange={e => setLang(e.target.value as any)}
              className="bg-transparent text-sm text-slate-300 border-none focus:outline-none cursor-pointer"
            >
              {langs.map(l => (
                <option key={l} value={l} className="bg-slate-900 text-white">{langNames[l]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ONG MADE</h1>
          <p className="text-slate-400 mt-2">Attendance & Member Management</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-600">
              <LogIn className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{t('signIn')}</h2>
              <p className="text-sm text-slate-400">{t('welcomeBack')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="madecme711@gmail.com"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="Mot de passe"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {submitting ? t('pleaseWait') : t('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


