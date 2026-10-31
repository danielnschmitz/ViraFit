import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { User, apiFetch } from '../api';
import { ErrorBox, Field, Modal, btnGhost, btnIcon, btnPrimary, cardCls, inputCls } from './ui';

interface SettingsModuleProps {
  currentUser: User;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ currentUser }) => {
  const canManageUsers = currentUser.role === 'admin' || currentUser.role === 'master';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configurações</h1>
        <p className="text-sm text-slate-500">
          Gerencie os usuários da sua organização e atualize os dados do seu perfil.
        </p>
      </div>
      {canManageUsers && <OrgUsersSection currentUser={currentUser} />}
      <ProfileSection currentUser={currentUser} />
    </div>
  );
};

const OrgUsersSection: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'standard',
    active: true,
  });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const orgId = currentUser.organization?.id || '';
      setUsers(
        await apiFetch<User[]>(
          `/api/master/users${currentUser.role === 'master' ? `?organization_id=${orgId}` : ''}`
        )
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (u: User | 'new') => {
    setError(null);
    setEditing(u);
    setForm(
      u === 'new'
        ? { username: '', name: '', email: '', password: '', role: 'standard', active: true }
        : {
            username: u.username,
            name: u.name,
            email: u.email || '',
            password: '',
            role: u.role,
            active: u.active !== false,
          }
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = JSON.stringify({ ...form, organization_id: currentUser.organization?.id });
      if (editing && editing !== 'new') {
        await apiFetch(`/api/master/users/${editing.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/master/users', { method: 'POST', body });
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const org = currentUser.organization;
  const admins = users.filter((u) => u.role === 'admin').length;
  const standards = users.filter((u) => u.role === 'standard').length;

  return (
    <section className={`${cardCls} p-5 space-y-4`} aria-labelledby="users-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-emerald-500" />
          <h2 id="users-title" className="font-semibold text-slate-900 dark:text-white">
            Usuários da Organização
          </h2>
          {org && (
            <span className="text-xs text-slate-500">
              Administradores: {admins}/{org.max_admins} • Padrão: {standards}/{org.max_users}
            </span>
          )}
        </div>
        <button type="button" className={btnPrimary} onClick={() => open('new')}>
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>
      <ErrorBox error={error} onClose={() => setError(null)} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left py-2.5">Nome</th>
              <th className="text-left py-2.5">Login</th>
              <th className="text-left py-2.5">E-mail</th>
              <th className="text-left py-2.5">Perfil</th>
              <th className="text-left py-2.5">Status</th>
              <th className="py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5 font-medium text-slate-900 dark:text-white">{u.name}</td>
                <td className="py-2.5 text-slate-600 dark:text-slate-300">@{u.username}</td>
                <td className="py-2.5 text-slate-500">{u.email || '—'}</td>
                <td className="py-2.5">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {u.role === 'admin' ? 'Administrador' : 'Padrão'}
                  </span>
                </td>
                <td className="py-2.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.active !== false
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {u.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button type="button" className={btnIcon} aria-label="Editar" onClick={() => open(u)}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      className={`${btnIcon} hover:text-rose-600`}
                      aria-label="Excluir"
                      onClick={async () => {
                        if (!window.confirm(`Excluir o usuário ${u.name}?`)) return;
                        try {
                          await apiFetch(`/api/master/users/${u.id}`, { method: 'DELETE' });
                          load();
                        } catch (err: any) {
                          setError(err.message);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Novo Usuário da Organização' : 'Editar Usuário'}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome *" htmlFor="ou-name">
              <input
                id="ou-name"
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Login *" htmlFor="ou-login">
              <input
                id="ou-login"
                required
                type="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail" htmlFor="ou-email">
              <input
                id="ou-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label={editing === 'new' ? 'Senha *' : 'Nova senha (opcional)'} htmlFor="ou-pass">
              <input
                id="ou-pass"
                type="password"
                autoComplete="new-password"
                required={editing === 'new'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputCls}
              />
            </Field>
            <fieldset className="sm:col-span-2 flex flex-wrap gap-5 text-sm p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <legend className="text-xs font-semibold uppercase text-slate-500 px-1">Perfil</legend>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ou-role"
                  checked={form.role === 'admin'}
                  onChange={() => setForm({ ...form, role: 'admin' })}
                />
                Administrador
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ou-role"
                  checked={form.role === 'standard'}
                  onChange={() => setForm({ ...form, role: 'standard' })}
                />
                Padrão
              </label>
              {editing !== 'new' && (
                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Ativo
                </label>
              )}
            </fieldset>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" className={btnGhost} onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="submit" className={btnPrimary}>
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};

const ProfileSection: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [form, setForm] = useState({
    name: currentUser.name,
    email: currentUser.email || '',
    currentPassword: '',
    newPassword: '',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      await apiFetch('/api/auth/profile', { method: 'PUT', body: JSON.stringify(form) });
      setMsg('Perfil atualizado com sucesso.');
      setForm({ ...form, currentPassword: '', newPassword: '' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section className={`${cardCls} p-5 space-y-4`} aria-labelledby="profile-title">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-emerald-500" />
        <h2 id="profile-title" className="font-semibold text-slate-900 dark:text-white">
          Meu Perfil e Senha
        </h2>
      </div>
      <ErrorBox error={error} onClose={() => setError(null)} />
      {msg && (
        <p role="status" className="text-sm text-emerald-600 font-medium">
          {msg}
        </p>
      )}
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <Field label="Nome" htmlFor="pr-name">
          <input
            id="pr-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="E-mail" htmlFor="pr-email">
          <input
            id="pr-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Senha atual" htmlFor="pr-cur">
          <input
            id="pr-cur"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Nova senha" htmlFor="pr-new">
          <input
            id="pr-new"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className={inputCls}
          />
        </Field>
        <button type="submit" className={btnPrimary}>
          Salvar perfil
        </button>
      </form>
    </section>
  );
};
