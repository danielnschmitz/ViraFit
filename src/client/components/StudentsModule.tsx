import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Organization, Student, StudentGroup, apiFetch } from '../api';
import {
  ErrorBox,
  Field,
  LoadingState,
  Modal,
  SearchableListbox,
  btnGhost,
  btnIcon,
  btnPrimary,
  cardCls,
  inputCls,
} from './ui';

interface StudentsModuleProps {
  org: Organization;
}

const emptyStudent = {
  name: '',
  document: '',
  phone: '',
  gender: 'Masculino' as Student['gender'],
  group_id: '',
  group_name: 'Presencial',
  notes: '',
  email: '',
  zip_code: '',
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  delivery_instructions: '',
};

export const StudentsModule: React.FC<StudentsModuleProps> = ({ org }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const [form, setForm] = useState(emptyStudent);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Modal de Cadastrar Grupo
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        apiFetch<Student[]>('/api/org/students'),
        apiFetch<StudentGroup[]>('/api/org/student-groups'),
      ]);
      setStudents(studentsRes);
      setGroups(groupsRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!groupFilter || s.group_name.toLowerCase() === groupFilter.toLowerCase()) &&
        (!genderFilter || s.gender === genderFilter) &&
        (!t ||
          s.name.toLowerCase().includes(t) ||
          (s.document || '').toLowerCase().includes(t) ||
          (s.phone || '').toLowerCase().includes(t) ||
          (s.email || '').toLowerCase().includes(t) ||
          (s.group_name || '').toLowerCase().includes(t))
    );
  }, [students, search, groupFilter, genderFilter]);

  const openModal = (s: Student | 'new') => {
    setError(null);
    setEditing(s);
    if (s === 'new') {
      const defaultGroup = groups.find((g) => g.name === 'Presencial') || groups[0];
      setForm({
        ...emptyStudent,
        group_id: defaultGroup?.id || '',
        group_name: defaultGroup?.name || 'Presencial',
      });
    } else {
      const matchedGroup = groups.find(
        (g) => g.id === s.group_id || g.name.toLowerCase() === s.group_name.toLowerCase()
      );
      setForm({
        name: s.name,
        document: s.document || '',
        phone: s.phone || '',
        gender: s.gender || 'Masculino',
        group_id: matchedGroup?.id || s.group_id || '',
        group_name: matchedGroup?.name || s.group_name || 'Presencial',
        notes: s.notes || '',
        email: s.email || '',
        zip_code: s.zip_code || '',
        street: s.street || '',
        neighborhood: s.neighborhood || '',
        city: s.city || '',
        state: s.state || '',
        delivery_instructions: s.delivery_instructions || '',
      });
    }
  };

  const lookupCep = async () => {
    const cep = form.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setForm((f) => ({
          ...f,
          street: f.street || d.logradouro || '',
          neighborhood: f.neighborhood || d.bairro || '',
          city: f.city || d.localidade || '',
          state: f.state || d.uf || '',
        }));
      }
    } catch {
      /* consulta opcional */
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.group_name) {
      setError('Selecione um grupo para o aluno.');
      return;
    }
    try {
      const body = JSON.stringify(form);
      if (editing && editing !== 'new') {
        await apiFetch(`/api/org/students/${editing.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/org/students', { method: 'POST', body });
      }
      setEditing(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setSavingGroup(true);
    setError(null);
    try {
      const created = await apiFetch<StudentGroup>('/api/org/student-groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const updatedGroups = await apiFetch<StudentGroup[]>('/api/org/student-groups');
      setGroups(updatedGroups);
      setForm((prev) => ({
        ...prev,
        group_id: created.id,
        group_name: created.name,
      }));
      setNewGroupName('');
      setGroupModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const removeStudent = async (s: Student) => {
    if (!window.confirm(`Deseja realmente excluir o aluno "${s.name}"?`)) return;
    try {
      await apiFetch(`/api/org/students/${s.id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestão de Alunos</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {students.length} / {org.max_students ?? 100} alunos
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Cadastre e gerencie seus alunos presenciais, online ou em grupos personalizados.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => openModal('new')}>
          <Plus className="w-4 h-4" /> Novo Aluno
        </button>
      </div>

      <ErrorBox error={error} onClose={() => setError(null)} />

      {/* Barra de filtros */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row gap-3`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="search"
            aria-label="Buscar aluno"
            placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          aria-label="Filtrar por grupo"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className={`${inputCls} sm:w-48`}
        >
          <option value="">Todos os grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por gênero"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className={`${inputCls} sm:w-44`}
        >
          <option value="">Todos os gêneros</option>
          <option value="Masculino">Masculino</option>
          <option value="Feminino">Feminino</option>
          <option value="Outro">Outro</option>
        </select>
      </div>

      {/* Tabela de Alunos */}
      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <tr>
              <th className="text-left px-4 py-3.5">Nome</th>
              <th className="text-left px-4 py-3.5">Grupo</th>
              <th className="text-left px-4 py-3.5">Gênero</th>
              <th className="text-left px-4 py-3.5">CPF/CNPJ</th>
              <th className="text-left px-4 py-3.5">Telefone</th>
              <th className="text-left px-4 py-3.5">E-mail</th>
              <th className="text-left px-4 py-3.5">Cidade/UF</th>
              <th className="px-4 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8">
                  <LoadingState message="Carregando alunos..." />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    <span>Nenhum aluno encontrado.</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                    {s.notes && <div className="text-xs text-slate-400 truncate max-w-xs">{s.notes}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        s.group_name.toLowerCase() === 'presencial'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : s.group_name.toLowerCase() === 'online'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}
                    >
                      {s.group_name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.gender}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.document}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.phone}</td>
                  <td className="px-4 py-3.5 text-slate-500">{s.email || '—'}</td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {s.city ? `${s.city}${s.state ? '/' + s.state : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button type="button" className={btnIcon} onClick={() => openModal(s)} aria-label="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={`${btnIcon} hover:text-rose-600`}
                      onClick={() => removeStudent(s)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Criar / Editar Aluno */}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Novo Aluno' : 'Editar Aluno'}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleSaveStudent} className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <Field label="Nome *" htmlFor="s-name" className="sm:col-span-4">
              <input
                id="s-name"
                required
                type="text"
                placeholder="Nome completo do aluno"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="CPF/CNPJ *" htmlFor="s-doc" className="sm:col-span-2">
              <input
                id="s-doc"
                required
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.document}
                onChange={(e) => set('document', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Telefone *" htmlFor="s-phone" className="sm:col-span-2">
              <input
                id="s-phone"
                required
                type="tel"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Gênero *" htmlFor="s-gender" className="sm:col-span-2">
              <select
                id="s-gender"
                required
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Student['gender'])}
                className={inputCls}
              >
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </Field>

            <Field label="Grupo *" className="sm:col-span-2">
              <SearchableListbox
                options={groups.map((g) => ({ id: g.id, name: g.name }))}
                value={form.group_id || form.group_name}
                onChange={(id, name) => setForm({ ...form, group_id: id, group_name: name })}
                placeholder="Selecione o grupo..."
                createLabel="Cadastrar grupo"
                onCreateOptionClick={() => {
                  setNewGroupName('');
                  setGroupModalOpen(true);
                }}
              />
            </Field>

            <Field label="E-mail" htmlFor="s-email" className="sm:col-span-6">
              <input
                id="s-email"
                type="email"
                placeholder="aluno@email.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Endereço */}
            <div className="sm:col-span-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Endereço
              </span>
            </div>

            <Field label={cepLoading ? 'CEP (buscando...)' : 'CEP'} htmlFor="s-cep" className="sm:col-span-2">
              <input
                id="s-cep"
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                value={form.zip_code}
                onChange={(e) => set('zip_code', e.target.value)}
                onBlur={lookupCep}
                className={inputCls}
              />
            </Field>
            <Field label="Rua" htmlFor="s-street" className="sm:col-span-4">
              <input
                id="s-street"
                type="text"
                value={form.street}
                onChange={(e) => set('street', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Bairro" htmlFor="s-nb" className="sm:col-span-2">
              <input
                id="s-nb"
                type="text"
                value={form.neighborhood}
                onChange={(e) => set('neighborhood', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Cidade" htmlFor="s-city" className="sm:col-span-3">
              <input
                id="s-city"
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Estado" htmlFor="s-state" className="sm:col-span-1">
              <input
                id="s-state"
                type="text"
                maxLength={2}
                placeholder="UF"
                value={form.state}
                onChange={(e) => set('state', e.target.value.toUpperCase())}
                className={inputCls}
              />
            </Field>
            <Field label="Instruções de entrega" htmlFor="s-di" className="sm:col-span-6">
              <textarea
                id="s-di"
                rows={2}
                placeholder="Complemento, ponto de referência, portaria..."
                value={form.delivery_instructions}
                onChange={(e) => set('delivery_instructions', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Observação" htmlFor="s-notes" className="sm:col-span-6">
              <textarea
                id="s-notes"
                rows={2}
                placeholder="Restrições médicas, objetivos, histórico..."
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="sm:col-span-6 flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button type="button" className={btnGhost} onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="submit" className={btnPrimary}>
                Salvar Aluno
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal secundário: Cadastrar Grupo */}
      {groupModalOpen && (
        <Modal title="Cadastrar Grupo de Alunos" onClose={() => setGroupModalOpen(false)}>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Field label="Nome do Grupo *" htmlFor="new-group-name">
              <input
                id="new-group-name"
                type="text"
                required
                autoFocus
                placeholder="Ex.: Consultoria VIP, Híbrido, Terceira Idade..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={btnGhost} onClick={() => setGroupModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={savingGroup} className={btnPrimary}>
                {savingGroup ? 'Salvando...' : 'Confirmar Cadastro'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
