import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  Shield,
  Filter,
  X,
  Upload,
  Dumbbell,
  GraduationCap,
  Layers,
} from 'lucide-react';
import {
  Organization,
  User,
  apiFetch,
  readFileAsDataUrl,
} from '../api';

interface MasterPanelProps {
  onEnterOrganization: (org: Organization) => void;
}

export const MasterPanel: React.FC<MasterPanelProps> = ({ onEnterOrganization }) => {
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'organizations' | 'users'>('metrics');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('');
  const [metricsData, setMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de Organização
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    document: '',
    phone: '',
    notes: '',
    logo: '',
    max_admins: 5,
    max_users: 10,
    max_students: 100,
    mod_students: true,
    mod_exercises: true,
  });

  // Modal de Usuário
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'admin' as 'admin' | 'standard',
    organization_id: '',
    active: true,
  });

  const loadOrganizations = async () => {
    try {
      const data = await apiFetch<Organization[]>('/api/master/organizations');
      setOrganizations(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadMetrics = async (orgId: string) => {
    try {
      setLoading(true);
      const q = orgId ? `?organization_id=${encodeURIComponent(orgId)}` : '';
      const data = await apiFetch(`/api/master/metrics${q}`);
      setMetricsData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (orgId: string) => {
    try {
      const q = orgId ? `?organization_id=${encodeURIComponent(orgId)}` : '';
      const data = await apiFetch<User[]>(`/api/master/users${q}`);
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadMetrics(selectedOrgFilter);
    loadUsers(selectedOrgFilter);
  }, [selectedOrgFilter]);

  const openNewOrgModal = () => {
    setEditingOrg(null);
    setOrgForm({
      name: '',
      document: '',
      phone: '',
      notes: '',
      logo: '',
      max_admins: 5,
      max_users: 10,
      max_students: 100,
      mod_students: true,
      mod_exercises: true,
    });
    setOrgModalOpen(true);
  };

  const openEditOrgModal = (org: Organization) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      document: org.document || '',
      phone: org.phone,
      notes: org.notes || '',
      logo: org.logo || '',
      max_admins: org.max_admins,
      max_users: org.max_users,
      max_students: org.max_students ?? 100,
      mod_students: org.mod_students !== false,
      mod_exercises: org.mod_exercises !== false,
    });
    setOrgModalOpen(true);
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingOrg) {
        await apiFetch(`/api/master/organizations/${editingOrg.id}`, {
          method: 'PUT',
          body: JSON.stringify(orgForm),
        });
      } else {
        await apiFetch('/api/master/organizations', {
          method: 'POST',
          body: JSON.stringify(orgForm),
        });
      }
      setOrgModalOpen(false);
      await loadOrganizations();
      await loadMetrics(selectedOrgFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteOrg = async (org: Organization) => {
    if (!window.confirm(`Deseja realmente excluir a organização "${org.name}" e todos os seus dados?`)) {
      return;
    }
    try {
      await apiFetch(`/api/master/organizations/${org.id}`, { method: 'DELETE' });
      if (selectedOrgFilter === org.id) setSelectedOrgFilter('');
      await loadOrganizations();
      await loadMetrics(selectedOrgFilter);
      await loadUsers(selectedOrgFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setOrgForm((prev) => ({ ...prev, logo: dataUrl }));
  };

  const openNewUserModal = (defaultOrgId?: string) => {
    setEditingUser(null);
    setUserForm({
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'admin',
      organization_id: defaultOrgId || selectedOrgFilter || organizations[0]?.id || '',
      active: true,
    });
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      name: u.name,
      email: u.email || '',
      password: '',
      role: u.role === 'master' ? 'admin' : u.role,
      organization_id: u.organization_id || '',
      active: u.active !== false,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingUser) {
        await apiFetch(`/api/master/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(userForm),
        });
      } else {
        await apiFetch('/api/master/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
      }
      setUserModalOpen(false);
      await loadUsers(selectedOrgFilter);
      await loadOrganizations();
      await loadMetrics(selectedOrgFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Deseja realmente excluir o usuário "${u.name}" (@${u.username})?`)) return;
    try {
      await apiFetch(`/api/master/users/${u.id}`, { method: 'DELETE' });
      await loadUsers(selectedOrgFilter);
      await loadOrganizations();
      await loadMetrics(selectedOrgFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar de Boas-vindas Master + Filtro por Organização */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 mb-2">
            <Shield className="w-3.5 h-3.5" />
            Painel Master Global
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Administração Multiorganização
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie personal trainers/academias, limites de usuários e alunos, módulos liberados ou acesse qualquer organização.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <Filter className="w-4 h-4 text-slate-500" />
            <label htmlFor="master-org-filter" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Filtrar Organização:
            </label>
            <select
              id="master-org-filter"
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden"
            >
              <option value="" className="dark:bg-slate-900">Todas as Organizações ({organizations.length})</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="dark:bg-slate-900">
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={openNewOrgModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Organização
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navegação Interna Master */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('metrics')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
            activeSubTab === 'metrics'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Métricas de Uso &amp; Acesso Rápido
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('organizations')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
            activeSubTab === 'organizations'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Cadastro de Organizações ({organizations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Usuários Vinculados ({users.length})
        </button>
      </div>

      {/* ABA 1: MÉTRICAS GERAIS E TABELA DE ORGANIZAÇÕES */}
      {activeSubTab === 'metrics' && metricsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Organizações</span>
                <Building2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {metricsData.summary.organizations}
              </div>
              <p className="text-xs text-slate-500 mt-1">Ativas no filtro atual</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Usuários</span>
                <Users className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {metricsData.summary.users.total_users}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metricsData.summary.users.total_admins} admins • {metricsData.summary.users.total_standards} padrão
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Alunos</span>
                <GraduationCap className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {metricsData.summary.students.total}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metricsData.summary.students.presencial} presencial • {metricsData.summary.students.online} online
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Exercícios</span>
                <Dumbbell className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {metricsData.summary.exercises.total}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metricsData.summary.exercises.favorites} favoritos • {metricsData.summary.exercises.with_media} com mídia
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Classificações</span>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {metricsData.summary.muscle_groups + metricsData.summary.categories}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metricsData.summary.muscle_groups} grupos musc. • {metricsData.summary.categories} categorias
              </p>
            </div>
          </div>

          {/* Lista de Organizações com botão "Entrar no Painel" */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Métricas de Uso por Organização
                </h2>
                <p className="text-xs text-slate-500">
                  Clique em &ldquo;Entrar na Organização&rdquo; para operar diretamente dentro de uma organização específica.
                </p>
              </div>
            </div>

            {metricsData.organizationsBreakdown.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                Nenhuma organização cadastrada ainda. Clique em &ldquo;Nova Organização&rdquo; para começar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                      <th className="py-3.5 px-6">Organização</th>
                      <th className="py-3.5 px-4">Usuários (Admin / Padrão)</th>
                      <th className="py-3.5 px-4">Alunos</th>
                      <th className="py-3.5 px-4">Exercícios</th>
                      <th className="py-3.5 px-4">Módulos Ativos</th>
                      <th className="py-3.5 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                    {metricsData.organizationsBreakdown.map((item: any) => {
                      const fullOrg = organizations.find((o) => o.id === item.id) || item;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {fullOrg.logo ? (
                                <img
                                  src={fullOrg.logo}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                                  {item.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                                <div className="text-xs text-slate-500">
                                  {item.phone} {item.document ? `• ${item.document}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Admins: {item.admins}/{item.max_admins}
                            </span>{' '}
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Usuários: {item.standards}/{item.max_users}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              {item.students} / {item.max_students}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {item.exercises}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {item.mod_students !== false && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Gestão de Alunos
                                </span>
                              )}
                              {item.mod_exercises !== false && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                  Exercícios
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEnterOrganization(fullOrg)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                Entrar na Organização
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditOrgModal(fullOrg)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Editar Organização"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: LISTA COMPLETA DE ORGANIZAÇÕES */}
      {activeSubTab === 'organizations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between gap-4 shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {org.logo ? (
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{org.name}</h3>
                      <p className="text-xs text-slate-500">{org.document || 'Sem CPF/CNPJ'}</p>
                      <p className="text-xs text-slate-500">{org.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditOrgModal(org)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrg(org)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {org.notes && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                    {org.notes}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400 block">Admins</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {org.admin_count ?? 0} / {org.max_admins}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400 block">Usuários</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {org.standard_count ?? 0} / {org.max_users}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-400 block">Alunos</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {org.students_count ?? 0} / {org.max_students}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openNewUserModal(org.id)}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  + Adicionar Usuário
                </button>
                <button
                  type="button"
                  onClick={() => onEnterOrganization(org)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Acessar Organização
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 3: GESTÃO DE USUÁRIOS GERAL */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Usuários Cadastrados
              </h2>
              <p className="text-xs text-slate-500">
                Gerencie usuários administradores e padrão de qualquer organização.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewUserModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="py-3.5 px-6">Nome / Login</th>
                  <th className="py-3.5 px-4">Organização</th>
                  <th className="py-3.5 px-4">Perfil</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white">{u.name}</div>
                      <div className="text-xs text-slate-500">
                        @{u.username} {u.email ? `• ${u.email}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {u.role === 'master' ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Acesso Global (Master)
                        </span>
                      ) : (
                        u.organization_name || '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          u.role === 'master'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : u.role === 'admin'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {u.role === 'master'
                          ? 'Master'
                          : u.role === 'admin'
                          ? 'Administrador'
                          : 'Padrão'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-6 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar Usuário"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {u.role !== 'master' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR ORGANIZAÇÃO */}
      {orgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
              </h3>
              <button
                type="button"
                onClick={() => setOrgModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrg} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-name" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Nome *
                  </label>
                  <input
                    id="org-name"
                    name="name"
                    type="text"
                    required
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="org-doc" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    id="org-doc"
                    name="document"
                    type="text"
                    value={orgForm.document}
                    onChange={(e) => setOrgForm({ ...orgForm, document: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-phone" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Telefone *
                  </label>
                  <input
                    id="org-phone"
                    name="phone"
                    type="text"
                    required
                    value={orgForm.phone}
                    onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="org-max-students" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Limite de Alunos
                  </label>
                  <input
                    id="org-max-students"
                    name="max_students"
                    type="number"
                    min={0}
                    value={orgForm.max_students}
                    onChange={(e) => setOrgForm({ ...orgForm, max_students: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-max-admins" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Limite de Usuários Administradores
                  </label>
                  <input
                    id="org-max-admins"
                    name="max_admins"
                    type="number"
                    min={1}
                    value={orgForm.max_admins}
                    onChange={(e) => setOrgForm({ ...orgForm, max_admins: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="org-max-users" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Limite de Usuários (Padrão)
                  </label>
                  <input
                    id="org-max-users"
                    name="max_users"
                    type="number"
                    min={0}
                    value={orgForm.max_users}
                    onChange={(e) => setOrgForm({ ...orgForm, max_users: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              {/* Upload de Logo */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Logo da Organização
                </label>
                <div className="flex items-center gap-4">
                  {orgForm.logo ? (
                    <img
                      src={orgForm.logo}
                      alt="Logo preview"
                      className="w-14 h-14 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-white p-1"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400">
                      Sem logo
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Selecionar Imagem
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {orgForm.logo && (
                    <button
                      type="button"
                      onClick={() => setOrgForm({ ...orgForm, logo: '' })}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      Remover logo
                    </button>
                  )}
                </div>
              </div>

              {/* Liberação de Módulos */}
              <fieldset className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <legend className="text-xs font-semibold uppercase text-slate-500 px-1">
                  Liberação de Módulos
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orgForm.mod_students}
                      onChange={(e) => setOrgForm({ ...orgForm, mod_students: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>1. Gestão de Alunos</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orgForm.mod_exercises}
                      onChange={(e) => setOrgForm({ ...orgForm, mod_exercises: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>2. Exercícios (Grupos, Categorias e Exercícios)</span>
                  </label>
                </div>
              </fieldset>

              <div>
                <label htmlFor="org-notes" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Observação
                </label>
                <textarea
                  id="org-notes"
                  rows={2}
                  value={orgForm.notes}
                  onChange={(e) => setOrgForm({ ...orgForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOrgModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-xs cursor-pointer"
                >
                  Salvar Organização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR USUÁRIO */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-5 space-y-4">
              {(!editingUser || editingUser.role !== 'master') && (
                <div>
                  <label htmlFor="u-org" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Organização *
                  </label>
                  <select
                    id="u-org"
                    required
                    value={userForm.organization_id}
                    onChange={(e) => setUserForm({ ...userForm, organization_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="">Selecione uma organização...</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="u-name" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    id="u-name"
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="u-username" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Usuário (Login) *
                  </label>
                  <input
                    id="u-username"
                    type="text"
                    required
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="u-email" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    E-mail
                  </label>
                  <input
                    id="u-email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="u-pass" className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    {editingUser ? 'Nova Senha (opcional)' : 'Senha *'}
                  </label>
                  <input
                    id="u-pass"
                    type="password"
                    required={!editingUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              {(!editingUser || editingUser.role !== 'master') && (
                <fieldset className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <legend className="text-xs font-semibold uppercase text-slate-500 px-1">
                    Tipo de Usuário na Organização
                  </legend>
                  <div className="flex flex-wrap items-center gap-6 mt-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={userForm.role === 'admin'}
                        onChange={() => setUserForm({ ...userForm, role: 'admin' })}
                      />
                      <span>Administrador (gere usuários da org)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={userForm.role === 'standard'}
                        onChange={() => setUserForm({ ...userForm, role: 'standard' })}
                      />
                      <span>Usuário Padrão</span>
                    </label>
                    {editingUser && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={userForm.active}
                          onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                        />
                        <span>Ativo</span>
                      </label>
                    )}
                  </div>
                </fieldset>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
