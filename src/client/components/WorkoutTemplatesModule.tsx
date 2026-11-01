import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Dumbbell,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  SCHEME_TYPES_INFO,
  StudentGroup,
  WorkoutExerciseItem,
  WorkoutTemplate,
  apiFetch,
  formatSchemeSummary,
} from '../api';
import {
  ErrorBox,
  Field,
  LoadingState,
  btnGhost,
  btnIcon,
  btnPrimary,
  cardCls,
  inputCls,
} from './ui';
import { WorkoutExercisesBuilder } from './WorkoutExercisesBuilder';

export const WorkoutTemplatesModule: React.FC = () => {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros da listagem
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  // Modo de edição/criação ('list' ou 'editor')
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | 'new' | null>(null);
  const [name, setName] = useState('');
  const [selectedGroupValue, setSelectedGroupValue] = useState<string>('ALL'); // 'ALL' = Todos, ou ID do grupo
  const [items, setItems] = useState<WorkoutExerciseItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tplRes, grpRes] = await Promise.all([
        apiFetch<WorkoutTemplate[]>('/api/org/workout-templates'),
        apiFetch<StudentGroup[]>('/api/org/student-groups'),
      ]);
      setTemplates(tplRes);
      setStudentGroups(grpRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTemplates = useMemo(() => {
    const t = search.trim().toLowerCase();
    return templates.filter((tpl) => {
      const matchGroup =
        !groupFilter ||
        (groupFilter === 'ALL'
          ? !tpl.student_group_id || tpl.student_group_name.toLowerCase() === 'todos'
          : tpl.student_group_id === groupFilter ||
            tpl.student_group_name.toLowerCase() === groupFilter.toLowerCase());
      const matchText =
        !t ||
        tpl.name.toLowerCase().includes(t) ||
        tpl.student_group_name.toLowerCase().includes(t) ||
        tpl.items.some((i) => i.exercise_name.toLowerCase().includes(t));
      return matchGroup && matchText;
    });
  }, [templates, search, groupFilter]);

  const startNewTemplate = () => {
    setError(null);
    setEditingTemplate('new');
    setName('');
    setSelectedGroupValue('ALL'); // Por padrão vem a opção Todos
    setItems([]);
  };

  const startEditTemplate = (tpl: WorkoutTemplate) => {
    setError(null);
    setEditingTemplate(tpl);
    setName(tpl.name);
    if (!tpl.student_group_id || tpl.student_group_name.toLowerCase() === 'todos') {
      setSelectedGroupValue('ALL');
    } else {
      setSelectedGroupValue(tpl.student_group_id);
    }
    setItems(tpl.items.map((i) => ({ ...i })));
  };

  const handleDuplicateTemplate = async (tpl: WorkoutTemplate) => {
    setError(null);
    try {
      await apiFetch('/api/org/workout-templates', {
        method: 'POST',
        body: JSON.stringify({
          name: `${tpl.name} (Cópia)`,
          student_group_id: tpl.student_group_id || null,
          student_group_name: tpl.student_group_name || 'Todos',
          items: tpl.items,
        }),
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTemplate = async (tpl: WorkoutTemplate) => {
    if (!window.confirm(`Deseja realmente excluir o template de treino "${tpl.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/workout-templates/${tpl.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O Nome do template de treino é obrigatório.');
      return;
    }

    const groupObj =
      selectedGroupValue === 'ALL'
        ? null
        : studentGroups.find((g) => g.id === selectedGroupValue) || null;

    const payload = {
      name: name.trim(),
      student_group_id: groupObj ? groupObj.id : null,
      student_group_name: groupObj ? groupObj.name : 'Todos',
      items,
    };

    setSaving(true);
    try {
      if (editingTemplate && editingTemplate !== 'new') {
        await apiFetch(`/api/org/workout-templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/org/workout-templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingTemplate(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================================
     VISÃO DE CRIAÇÃO / EDIÇÃO DE TEMPLATE DE TREINO
     ========================================================================= */
  if (editingTemplate) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingTemplate(null)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Voltar"
              title="Voltar para a lista de templates"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingTemplate === 'new'
                  ? 'Novo Template de Treino'
                  : `Editar Template — ${editingTemplate.name}`}
              </h1>
              <p className="text-xs text-slate-500">
                Defina o nome, o grupo de alunos e monte a lista de exercícios com seus esquemas de execução.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingTemplate(null)}
              className={btnGhost}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveTemplate}
              className={btnPrimary}
            >
              {saving ? 'Salvando...' : 'Salvar Template de Treino'}
            </button>
          </div>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />

        {/* Dados Principais do Template */}
        <form onSubmit={handleSaveTemplate} className={`${cardCls} p-5 space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <Field label="Nome do Template de Treino *" className="md:col-span-8">
              <input
                type="text"
                required
                placeholder="Ex: Hipertrofia A - Superiores, Adaptação Iniciante, Treino Funcional..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Grupo de Alunos *" className="md:col-span-4">
              <select
                required
                value={selectedGroupValue}
                onChange={(e) => setSelectedGroupValue(e.target.value)}
                className={inputCls}
              >
                <option value="ALL">Todos</option>
                {studentGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>

        {/* Construtor Reutilizável de Lista de Exercícios */}
        <WorkoutExercisesBuilder items={items} onChange={setItems} />
      </div>
    );
  }

  /* =========================================================================
     VISÃO DE LISTAGEM DE TEMPLATES DE TREINO
     ========================================================================= */
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Templates de Treino
          </h1>
          <p className="text-sm text-slate-500">
            Crie modelos de treino padronizados com séries, repetições e esquemas pré-definidos.
          </p>
        </div>

        <button type="button" onClick={startNewTemplate} className={btnPrimary}>
          <Plus className="w-4 h-4" /> Novo Template de Treino
        </button>
      </div>

      <ErrorBox error={error} onClose={() => setError(null)} />

      {/* Barra de Busca e Filtro por Grupo de Alunos */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar template por nome ou exercício..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>

        <select
          aria-label="Filtrar por grupo de alunos"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className={`${inputCls} sm:w-56`}
        >
          <option value="">Todos os grupos de alunos</option>
          <option value="ALL">Apenas marcados como "Todos"</option>
          {studentGroups.map((g) => (
            <option key={g.id} value={g.id}>
              Grupo: {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className={cardCls}>
          <LoadingState message="Carregando templates de treino..." />
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className={`${cardCls} p-12 text-center space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">
            Nenhum template de treino encontrado
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Crie templates de treino com exercícios e esquemas de séries/repetições para reutilizar rapidamente com seus alunos.
          </p>
          <div>
            <button type="button" onClick={startNewTemplate} className={btnPrimary}>
              <Plus className="w-4 h-4" /> Criar Primeiro Template
            </button>
          </div>
        </div>
      )}

      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className={`${cardCls} p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/40 transition`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {tpl.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <Users className="w-3 h-3" />
                        Grupo: {tpl.student_group_name || 'Todos'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Dumbbell className="w-3 h-3" />
                        {tpl.items.length} exercício(s)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditTemplate(tpl)}
                      className={btnIcon}
                      title="Editar template"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateTemplate(tpl)}
                      className={btnIcon}
                      title="Duplicar template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      className={`${btnIcon} hover:text-rose-600`}
                      title="Excluir template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Prévia dos exercícios do template */}
                {tpl.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum exercício adicionado a este template.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {tpl.items.slice(0, 5).map((item, idx) => {
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
                    {tpl.items.length > 5 && (
                      <div className="text-xs text-slate-400 pt-1">
                        + {tpl.items.length - 5} outro(s) exercício(s)...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => startEditTemplate(tpl)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Abrir e editar exercícios →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
