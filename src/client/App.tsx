import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  FolderKanban,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import {
  Organization,
  User,
  apiFetch,
  getActiveOrgId,
  getStoredToken,
  setActiveOrgId,
  setStoredToken,
} from './api';
import { MasterPanel } from './components/MasterPanel';
import { OrgDashboard } from './components/OrgDashboard';
import { StudentsModule } from './components/StudentsModule';
import { ExercisesModule } from './components/ExercisesModule';
import { WorkoutTemplatesModule } from './components/WorkoutTemplatesModule';
import { SettingsModule } from './components/SettingsModule';
import { ErrorBox, btnPrimary, inputCls, labelCls } from './components/ui';

type View = 'dashboard' | 'students' | 'exercises' | 'workout_templates' | 'settings';

/* ---------------- Tema claro/escuro (override do esquema do sistema) ---------------- */
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyScheme(stored: string | null) {
  const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  if (meta) meta.content = stored === 'light' || stored === 'dark' ? stored : 'light dark';
  const dark = stored === 'dark' || (!stored && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

function useColorScheme() {
  const read = () => {
    try {
      return localStorage.getItem('color-scheme');
    } catch {
      return null;
    }
  };
  const [stored, setStored] = useState<string | null>(read);
  const [, force] = useState(0);

  useEffect(() => {
    applyScheme(stored);
  }, [stored]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyScheme(read());
      force((n) => n + 1);
    };
    const onStorage = (e: StorageEvent) => e.key === 'color-scheme' && setStored(read());
    mq.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isDark = stored === 'dark' || (!stored && systemDark());

  const toggle = () => {
    const target = isDark ? 'light' : 'dark';
    const sys = systemDark() ? 'dark' : 'light';
    try {
      if (target === sys) localStorage.removeItem('color-scheme');
      else localStorage.setItem('color-scheme', target);
    } catch {
      /* armazenamento indisponível */
    }
    setStored(target === sys ? null : target);
  };

  return { isDark, toggle };
}

const ThemeToggle: React.FC<{ isDark: boolean; toggle: () => void }> = ({ isDark, toggle }) => (
  <button
    type="button"
    onClick={toggle}
    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
    aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    title={isDark ? 'Tema claro' : 'Tema escuro'}
  >
    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
);

const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center gap-2.5 ${className || ''}`}>
    <img
      src="/favicon.svg"
      alt="ViraFit"
      className="w-8 h-8 shrink-0 object-contain drop-shadow-xs"
    />
    <span className="font-bold tracking-tight text-lg">
      Vira<span className="text-emerald-600 dark:text-emerald-400">Fit</span>
    </span>
  </div>
);

/* ---------------- Login ---------------- */
const LoginScreen: React.FC<{ onLogin: (token: string) => void; theme: ReturnType<typeof useColorScheme> }> = ({
  onLogin,
  theme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
      <div className="absolute top-4 right-4">
        <ThemeToggle {...theme} />
      </div>
      <div className="w-full max-w-sm bg-white/85 dark:bg-slate-900/85 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
        <Logo className="justify-center mb-2" />
        <p className="text-center text-sm text-slate-500 mb-6">
          Plataforma de gestão para Personal Trainers
        </p>
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox error={error} onClose={() => setError(null)} />
          <div>
            <label htmlFor="login-user" className={labelCls}>
              Usuário
            </label>
            <input
              id="login-user"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="login-pass" className={labelCls}>
              Senha
            </label>
            <input
              id="login-pass"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Troca Obrigatória de Senha no Primeiro Acesso ---------------- */
const ForcePasswordChangeScreen: React.FC<{
  user: User;
  onSuccess: () => void;
  onLogout: () => void;
  theme: ReturnType<typeof useColorScheme>;
}> = ({ user, onSuccess, onLogout, theme }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.trim().length < 4) {
      setError('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/api/auth/first-access-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle {...theme} />
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Primeiro Acesso — Defina sua Senha
          </h1>
          <p className="text-sm text-slate-500">
            Olá, <strong>{user.name}</strong> (@{user.username}). Por segurança, você precisa alterar sua senha provisória antes de continuar.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <ErrorBox error={error} onClose={() => setError(null)} />
          <div>
            <label htmlFor="first-new-pass" className={labelCls}>
              Nova Senha *
            </label>
            <input
              id="first-new-pass"
              type="password"
              required
              autoFocus
              minLength={4}
              autoComplete="new-password"
              placeholder="Digite sua nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="first-confirm-pass" className={labelCls}>
              Confirmar Nova Senha *
            </label>
            <input
              id="first-confirm-pass"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
              placeholder="Repita sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? 'Salvando nova senha...' : 'Confirmar e Acessar o Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Escolha do Master ---------------- */
const MasterChoice: React.FC<{
  user: User;
  onPanel: () => void;
  onOrg: (org: Organization) => void;
  onLogout: () => void;
  theme: ReturnType<typeof useColorScheme>;
}> = ({ user, onPanel, onOrg, onLogout, theme }) => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    apiFetch<Organization[]>('/api/master/organizations').then(setOrgs).catch(() => {});
  }, []);
  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <header className="max-w-5xl mx-auto flex items-center justify-between mb-10">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle {...theme} />
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Olá, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-500">Para onde você deseja ir?</p>
        </div>
        <button
          type="button"
          onClick={onPanel}
          className="w-full text-left p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center gap-4 hover:opacity-95 transition cursor-pointer shadow-lg shadow-emerald-500/20"
        >
          <Shield className="w-10 h-10 shrink-0" />
          <div>
            <div className="text-lg font-bold">Painel de Administração</div>
            <div className="text-sm text-emerald-100">
              Organizações, usuários, limites e métricas de uso gerais
            </div>
          </div>
        </button>
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">Entrar em uma organização específica</h2>
            <input
              type="search"
              aria-label="Buscar organização"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} max-w-xs`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400">
                Nenhuma organização. Crie uma no Painel de Administração.
              </p>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onOrg(o)}
                className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition flex items-center gap-3 cursor-pointer"
              >
                {o.logo ? (
                  <img src={o.logo} alt="" className="w-11 h-11 rounded-xl object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    {o.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{o.name}</div>
                  <div className="text-xs text-slate-500">{o.phone}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

/* ---------------- App Principal ---------------- */
export default function App() {
  const theme = useColorScheme();
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [masterMode, setMasterMode] = useState<'choice' | 'panel' | 'org'>(() =>
    getActiveOrgId() ? 'org' : 'choice'
  );
  const [view, setView] = useState<View>('dashboard');
  const [exerciseSubTab, setExerciseSubTab] = useState<'exercises' | 'muscle_groups' | 'categories'>('exercises');
  const [exercisesMenuOpen, setExercisesMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(res.user);
      if (res.user.role === 'master' && getActiveOrgId() && !res.user.organization) {
        setActiveOrgId(null);
        setMasterMode('choice');
      }
    } catch {
      setStoredToken(null);
      setActiveOrgId(null);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadMe();
  }, [token, loadMe]);

  const logout = () => {
    setStoredToken(null);
    setActiveOrgId(null);
    setToken(null);
    setUser(null);
    setMasterMode('choice');
    setView('dashboard');
  };

  const enterOrg = async (org: Organization) => {
    setActiveOrgId(org.id);
    setMasterMode('org');
    setView('dashboard');
    setLoading(true);
    await loadMe();
  };

  const leaveOrg = () => {
    setActiveOrgId(null);
    setMasterMode('choice');
    loadMe();
  };

  if (!token) {
    return (
      <LoginScreen
        theme={theme}
        onLogin={(t) => {
          setStoredToken(t);
          setActiveOrgId(null);
          setMasterMode('choice');
          setLoading(true);
          setToken(t);
        }}
      />
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Carregando...
      </div>
    );
  }

  if (user.must_change_password) {
    return (
      <ForcePasswordChangeScreen
        user={user}
        theme={theme}
        onLogout={logout}
        onSuccess={() => {
          setLoading(true);
          loadMe();
        }}
      />
    );
  }

  const isMaster = user.role === 'master';

  if (isMaster && masterMode === 'choice') {
    return (
      <MasterChoice
        user={user}
        theme={theme}
        onLogout={logout}
        onPanel={() => setMasterMode('panel')}
        onOrg={enterOrg}
      />
    );
  }

  if (isMaster && masterMode === 'panel') {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMasterMode('choice')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" /> Trocar destino
              </button>
              <ThemeToggle {...theme} />
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-4 sm:p-6">
          <MasterPanel onEnterOrganization={enterOrg} />
        </main>
      </div>
    );
  }

  const org = user.organization;
  if (!org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        Nenhuma organização vinculada a este usuário.
        <button type="button" className={btnPrimary} onClick={logout}>
          Sair
        </button>
      </div>
    );
  }

  const nav: {
    id: View;
    label: string;
    icon: any;
    show: boolean;
    children?: { id: View; label: string; icon: any }[];
  }[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, show: true },
    { id: 'students', label: 'Gestão de Alunos', icon: GraduationCap, show: org.mod_students !== false },
    {
      id: 'exercises',
      label: 'Exercícios',
      icon: Dumbbell,
      show: org.mod_exercises !== false,
      children: [
        { id: 'exercises', label: 'Cadastros', icon: FolderKanban },
        { id: 'workout_templates', label: 'Templates de treino', icon: ClipboardList },
      ],
    },
    { id: 'settings', label: 'Configurações', icon: Settings, show: true },
  ];

  const visibleNav = nav.filter((n) => n.show);
  const currentView = visibleNav.some((n) => n.id === view || n.children?.some((c) => c.id === view))
    ? view
    : 'dashboard';

  const go = (v: View, sub?: 'exercises' | 'muscle_groups' | 'categories') => {
    if (sub) setExerciseSubTab(sub);
    if (v === 'exercises' || v === 'workout_templates') setExercisesMenuOpen(true);
    setView(v);
    setMenuOpen(false);
  };

  const sidebar = (
    <nav className="flex flex-col h-full" aria-label="Menu principal">
      <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
        <Logo />
      </div>
      <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
        {org.logo ? (
          <img src={org.logo} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{org.name}</div>
          <div className="text-xs text-slate-500 truncate">
            {user.name} • {isMaster ? 'Master' : user.role === 'admin' ? 'Administrador' : 'Padrão'}
          </div>
        </div>
      </div>
      <ul className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNav.map((n) => {
          if (n.children && n.children.length > 0) {
            const isChildActive = n.children.some((c) => c.id === currentView);
            const isOpen = exercisesMenuOpen || isChildActive;
            return (
              <li key={n.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setExercisesMenuOpen((prev) => !prev)}
                  aria-expanded={isOpen}
                  title={n.label}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                    isChildActive
                      ? 'text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <n.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate whitespace-nowrap">{n.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <ul className="pl-6 pr-1 py-0.5 space-y-1 border-l border-slate-200 dark:border-slate-800 ml-5">
                    {n.children.map((subItem) => {
                      const active = currentView === subItem.id;
                      return (
                        <li key={subItem.label}>
                          <button
                            type="button"
                            onClick={() => go(subItem.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                              active
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <subItem.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate whitespace-nowrap">{subItem.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          }

          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => go(n.id)}
                aria-current={currentView === n.id ? 'page' : undefined}
                title={n.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  currentView === n.id
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <n.icon className="w-4 h-4 shrink-0" />
                <span className="truncate whitespace-nowrap">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {isMaster && (
          <button
            type="button"
            onClick={leaveOrg}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" /> Sair da organização
          </button>
        )}
        <div className="flex items-center justify-between px-1">
          <ThemeToggle {...theme} />
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen print:hidden">
        {sidebar}
      </aside>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-white dark:bg-slate-900 h-full shadow-xl">{sidebar}</div>
          <button
            type="button"
            aria-label="Fechar menu"
            className="flex-1 bg-slate-950/50"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 print:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-2"
            aria-label="Abrir menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Logo />
          <ThemeToggle {...theme} />
        </header>
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <OrgDashboard
              org={org}
              onNavigate={(v, sub) => go(v, sub)}
            />
          )}
          {currentView === 'students' && <StudentsModule org={org} />}
          {currentView === 'exercises' && <ExercisesModule initialSubTab={exerciseSubTab} />}
          {currentView === 'workout_templates' && <WorkoutTemplatesModule />}
          {currentView === 'settings' && <SettingsModule currentUser={user} />}
        </main>
      </div>
    </div>
  );
}
