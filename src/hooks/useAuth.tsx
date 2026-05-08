import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Tenant } from '@/lib/types';

interface AuthContextType {
  user: { id: string; email: string } | null;
  tenant: Tenant | null;
  tenantRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_EMAIL = 'madecme711@gmail.com';
const ADMIN_PASSWORD = 'madecme@711';

function sanitizeEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async (userId: string) => {
    try {
      const { data: tu } = await supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!tu) {
        setTenant(null);
        setTenantRole(null);
        return;
      }

      setTenantRole(tu.role);

      const { data: t } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tu.tenant_id)
        .maybeSingle();

      setTenant(t || null);
    } catch {
      setTenant(null);
      setTenantRole(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' });
          await loadTenant(session.user.id);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        loadTenant(session.user.id);
      } else {
        setUser(null);
        setTenant(null);
        setTenantRole(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadTenant]);

  async function signIn(rawEmail: string, rawPassword: string): Promise<{ error: string | null }> {
    const email = sanitizeEmail(rawEmail);
    const password = rawPassword;

    if (!email || !password) {
      return { error: 'Veuillez remplir tous les champs' };
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return { error: 'Identifiants incorrects' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('Invalid login credentials')) {
          return { error: 'Identifiants incorrects. Contactez l\'administrateur.' };
        }
        if (msg.includes('Email not confirmed')) {
          return { error: 'Email non confirme. Verifiez votre boite mail.' };
        }
        if (msg.includes('too many requests') || msg.includes('rate limit')) {
          return { error: 'Trop de tentatives. Reessayez dans un instant.' };
        }
        return { error: 'Erreur de connexion. Reessayez.' };
      }

      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? '' });
        await loadTenant(data.user.id);
        return { error: null };
      }

      return { error: 'Erreur de connexion. Reessayez.' };
    } catch (err: any) {
      return { error: err.message || 'Erreur de connexion' };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setTenant(null);
    setTenantRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, tenant, tenantRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


