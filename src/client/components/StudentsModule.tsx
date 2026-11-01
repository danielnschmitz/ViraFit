import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Dumbbell,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Organization,
  SCHEME_TYPES_INFO,
  Student,
  StudentGroup,
  StudentWorkout,
  WorkoutExerciseItem,
  WorkoutTemplate,
  apiFetch,
  formatSchemeSummary,
} from '../api';
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
import { WorkoutExercisesBuilder } from './WorkoutExercisesBuilder';

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

  // Ficha do Aluno Selecionado e Programação de Treinos
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentWorkouts, setStudentWorkouts] = useState<StudentWorkout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);

  // Criação / Edição de Treino do Aluno
  const [editingWorkout, setEditingWorkout] = useState<StudentWorkout | 'new' | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [workoutItems, setWorkoutItems] = useState<WorkoutExerciseItem[]>([]);
  const [selectedTemplateToImport, setSelectedTemplateToImport] = useState('');
  const [savingWorkout, setSavingWorkout] = useState(false);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

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

  const loadStudentWorkouts = async (studentId: string) => {
    setLoadingWorkouts(true);
    try {
      const [wkRes, tplRes] = await Promise.all([
        apiFetch<StudentWorkout[]>(`/api/org/students/${studentId}/workouts`),
        apiFetch<WorkoutTemplate[]>('/api/org/workout-templates'),
      ]);
      setStudentWorkouts(wkRes);
      setTemplates(tplRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingWorkouts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentWorkouts(selectedStudentId);
    }
  }, [selectedStudentId]);

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
      if (selectedStudentId === s.id) {
        setSelectedStudentId(null);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* -------------------- Lógica de Treinos do Aluno -------------------- */
  const startNewStudentWorkout = () => {
    setError(null);
    setEditingWorkout('new');
    setWorkoutName('');
    setWorkoutNotes('');
    setWorkoutItems([]);
    setSelectedTemplateToImport('');
  };

  const startEditStudentWorkout = (wk: StudentWorkout) => {
    setError(null);
    setEditingWorkout(wk);
    setWorkoutName(wk.name);
    setWorkoutNotes(wk.notes || '');
    setWorkoutItems(wk.items.map((i) => ({ ...i })));
    setSelectedTemplateToImport('');
  };

  const handleImportTemplateIntoWorkout = (templateId: string) => {
    setSelectedTemplateToImport(templateId);
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    if (!workoutName.trim()) {
      setWorkoutName(tpl.name);
    }
    setWorkoutItems(tpl.items.map((i) => ({ ...i })));
  };

  const handleSaveStudentWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError(null);

    if (!workoutName.trim()) {
      setError('O Nome do treino é obrigatório.');
      return;
    }

    setSavingWorkout(true);
    try {
      const payload = {
        name: workoutName.trim(),
        notes: workoutNotes.trim() || null,
        items: workoutItems,
      };

      if (editingWorkout && editingWorkout !== 'new') {
        await apiFetch(`/api/org/students/${selectedStudent.id}/workouts/${editingWorkout.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/org/students/${selectedStudent.id}/workouts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setEditingWorkout(null);
      await Promise.all([loadStudentWorkouts(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleDuplicateStudentWorkout = async (wk: StudentWorkout) => {
    if (!selectedStudent) return;
    setError(null);
    try {
      await apiFetch(`/api/org/students/${selectedStudent.id}/workouts`, {
        method: 'POST',
        body: JSON.stringify({
          name: `${wk.name} (Cópia)`,
          notes: wk.notes || null,
          items: wk.items,
        }),
      });
      await Promise.all([loadStudentWorkouts(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStudentWorkout = async (wk: StudentWorkout) => {
    if (!selectedStudent) return;
    if (!window.confirm(`Deseja realmente excluir o treino "${wk.name}" deste aluno?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/students/${selectedStudent.id}/workouts/${wk.id}`, {
        method: 'DELETE',
      });
      await Promise.all([loadStudentWorkouts(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  /* =========================================================================
     MODAL DE EDIÇÃO DE DADOS DO ALUNO E GRUPO (Compartilhado)
     ========================================================================= */
  const studentModals = (
    <>
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
    </>
  );

  /* =========================================================================
     VISÃO 3: CRIANDO / EDITANDO TREINO DENTRO DA FICHA DO ALUNO
     ========================================================================= */
  if (selectedStudent && editingWorkout) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingWorkout(null)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Voltar para a ficha do aluno"
              title="Voltar para a ficha do aluno"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingWorkout === 'new'
                    ? `Cadastrar Treino — ${selectedStudent.name}`
                    : `Editar Treino — ${editingWorkout.name}`}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Aluno: {selectedStudent.name} ({selectedStudent.group_name})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Monte a lista de exercícios com séries, repetições, peso e descanso para este aluno.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingWorkout(null)}
              className={btnGhost}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={savingWorkout}
              onClick={handleSaveStudentWorkout}
              className={btnPrimary}
            >
              {savingWorkout ? 'Salvando...' : 'Salvar Treino do Aluno'}
            </button>
          </div>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />

        {/* Dados Principais do Treino do Aluno + Opção rápida de importar de um Template */}
        <form onSubmit={handleSaveStudentWorkout} className={`${cardCls} p-5 space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <Field label="Nome do Treino *" className="md:col-span-5">
              <input
                type="text"
                required
                placeholder="Ex: Treino A - Superiores, Treino B - Inferiores..."
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Observações do Treino (Opcional)" className="md:col-span-4">
              <input
                type="text"
                placeholder="Ex: Aquecer 10 min na esteira antes de iniciar..."
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Carregar de um Template (Opcional)" className="md:col-span-3">
              <select
                value={selectedTemplateToImport}
                onChange={(e) => handleImportTemplateIntoWorkout(e.target.value)}
                className={inputCls}
              >
                <option value="">Selecionar template...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.items.length} ex.)
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>

        {/* Construtor Reutilizável de Lista de Exercícios */}
        <WorkoutExercisesBuilder items={workoutItems} onChange={setWorkoutItems} />
      </div>
    );
  }

  /* =========================================================================
     VISÃO 2: FICHA DO ALUNO E PROGRAMAÇÃO DE TREINOS
     ========================================================================= */
  if (selectedStudent) {
    return (
      <div className="space-y-5">
        {/* Cabeçalho da Ficha do Aluno */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedStudentId(null)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Voltar para lista de alunos"
              title="Voltar para lista de alunos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedStudent.name}
                </h1>
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    selectedStudent.group_name.toLowerCase() === 'presencial'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : selectedStudent.group_name.toLowerCase() === 'online'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                  }`}
                >
                  {selectedStudent.group_name}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {selectedStudent.gender}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ficha do aluno e programação de treinos personalizados
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openModal(selectedStudent)}
              className={btnGhost}
            >
              <Pencil className="w-4 h-4" /> Editar Dados do Aluno
            </button>
            <button
              type="button"
              onClick={startNewStudentWorkout}
              className={btnPrimary}
            >
              <Plus className="w-4 h-4" /> Cadastrar Treino
            </button>
          </div>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />

        {/* Card de Resumo dos Dados do Aluno */}
        <div className={`${cardCls} p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs`}>
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400 uppercase font-semibold text-[10px]">CPF/CNPJ</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {selectedStudent.document}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400 uppercase font-semibold text-[10px]">Telefone</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {selectedStudent.phone}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400 uppercase font-semibold text-[10px]">E-mail</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {selectedStudent.email || 'Não informado'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400 uppercase font-semibold text-[10px]">Endereço</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {selectedStudent.street
                  ? `${selectedStudent.street}${selectedStudent.neighborhood ? `, ${selectedStudent.neighborhood}` : ''}${
                      selectedStudent.city ? ` — ${selectedStudent.city}/${selectedStudent.state || ''}` : ''
                    }`
                  : selectedStudent.city
                  ? `${selectedStudent.city}/${selectedStudent.state || ''}`
                  : 'Não informado'}
              </div>
            </div>
          </div>

          {selectedStudent.notes && (
            <div className="sm:col-span-2 lg:col-span-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200">Observações do Aluno: </span>
              {selectedStudent.notes}
            </div>
          )}
        </div>

        {/* Seção: Programação de Treinos do Aluno */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Programação de Treinos ({studentWorkouts.length})
              </h2>
              <p className="text-xs text-slate-500">
                Treinos vinculados diretamente à ficha de {selectedStudent.name}
              </p>
            </div>
          </div>

          {loadingWorkouts && (
            <div className={cardCls}>
              <LoadingState message="Carregando treinos do aluno..." />
            </div>
          )}

          {!loadingWorkouts && studentWorkouts.length === 0 && (
            <div className={`${cardCls} p-12 text-center space-y-3`}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                Nenhum treino cadastrado para este aluno
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Clique em "Cadastrar Treino" para montar a programação de exercícios personalizada para {selectedStudent.name}.
              </p>
              <div>
                <button type="button" onClick={startNewStudentWorkout} className={btnPrimary}>
                  <Plus className="w-4 h-4" /> Cadastrar Treino
                </button>
              </div>
            </div>
          )}

          {!loadingWorkouts && studentWorkouts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studentWorkouts.map((wk) => (
                <div
                  key={wk.id}
                  className={`${cardCls} p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/40 transition`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                          {wk.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Dumbbell className="w-3 h-3" />
                            {wk.items.length} exercício(s)
                          </span>
                          {wk.notes && (
                            <span className="text-xs text-slate-500 italic truncate max-w-xs">
                              {wk.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditStudentWorkout(wk)}
                          className={btnIcon}
                          title="Editar treino"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateStudentWorkout(wk)}
                          className={btnIcon}
                          title="Duplicar treino"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudentWorkout(wk)}
                          className={`${btnIcon} hover:text-rose-600`}
                          title="Excluir treino"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {wk.items.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Nenhum exercício adicionado a este treino.
                      </p>
                    ) : (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {wk.items.map((item, idx) => {
                          const schemeMeta =
                            SCHEME_TYPES_INFO[item.scheme_type] || SCHEME_TYPES_INFO.series_retas;
                          return (
                            <div
                              key={item.id || `${item.exercise_id}-${idx}`}
                              className="flex items-center justify-between gap-2 text-xs py-1"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {item.exercise_name}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold shrink-0 ${schemeMeta.badgeCls}`}
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                {formatSchemeSummary(item)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => startEditStudentWorkout(wk)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Abrir e editar treino →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {studentModals}
      </div>
    );
  }

  /* =========================================================================
     VISÃO 1: LISTAGEM GERAL DE ALUNOS
     ========================================================================= */
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
            Cadastre seus alunos e acesse a ficha individual para montar a programação de treinos.
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
              <th className="text-left px-4 py-3.5">Treinos</th>
              <th className="text-left px-4 py-3.5">Gênero</th>
              <th className="text-left px-4 py-3.5">Telefone</th>
              <th className="text-left px-4 py-3.5">Cidade/UF</th>
              <th className="px-4 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8">
                  <LoadingState message="Carregando alunos..." />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
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
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="text-left group cursor-pointer"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {s.document}
                        {s.notes ? ` • ${s.notes}` : ''}
                      </div>
                    </button>
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
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition cursor-pointer"
                    >
                      <Dumbbell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {s.workouts_count ?? 0} treino(s)
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.gender}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.phone}</td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {s.city ? `${s.city}${s.state ? '/' + s.state : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition cursor-pointer"
                      title="Abrir ficha e programação de treinos do aluno"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Ficha / Treinos
                    </button>
                    <button
                      type="button"
                      className={btnIcon}
                      onClick={() => openModal(s)}
                      aria-label="Editar"
                      title="Editar cadastro do aluno"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={`${btnIcon} hover:text-rose-600`}
                      onClick={() => removeStudent(s)}
                      aria-label="Excluir"
                      title="Excluir aluno"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {studentModals}
    </div>
  );
};
