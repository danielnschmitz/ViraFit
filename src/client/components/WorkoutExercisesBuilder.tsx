import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Clock,
  Copy,
  Dumbbell,
  Hash,
  Info,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  Exercise,
  ExerciseCategory,
  ExerciseScheme,
  MuscleGroup,
  RepUnit,
  RestUnit,
  SCHEME_TYPES_INFO,
  SchemeType,
  WorkoutExerciseItem,
  apiFetch,
  extractYoutubeId,
  formatSchemeSummary,
} from '../api';
import {
  ErrorBox,
  Field,
  Modal,
  btnGhost,
  btnIcon,
  btnPrimary,
  cardCls,
  inputCls,
} from './ui';

interface WorkoutExercisesBuilderProps {
  items: WorkoutExerciseItem[];
  onChange: (items: WorkoutExerciseItem[]) => void;
}

const SCHEME_TYPE_KEYS: SchemeType[] = [
  'series_retas',
  'piramide',
  'drop_set',
  'rest_pause',
  'ate_a_falha',
];

function buildSuggestedSchemeName(
  schemeType: SchemeType,
  sets: number,
  reps: string,
  repUnit: RepUnit
): string {
  const cleanReps = reps.trim() || '10';
  const unitLabel = repUnit === 'seconds' ? 'seg' : repUnit === 'minutes' ? 'min' : '';
  const suffix = unitLabel ? ` ${unitLabel}` : '';

  switch (schemeType) {
    case 'series_retas':
      return `${sets}x${unitLabel ? ' ' : ''}${cleanReps}${suffix}`;
    case 'piramide':
      return `Pirâmide ${cleanReps}${suffix}`;
    case 'drop_set':
      return `Drop-set ${sets}x${cleanReps}${suffix}`;
    case 'rest_pause':
      return `Rest-Pause ${sets}x${cleanReps}${suffix}`;
    case 'ate_a_falha':
      return cleanReps.toLowerCase().includes('falha')
        ? `${sets}x Até a Falha`
        : `Até a Falha (${sets}x${cleanReps}${suffix})`;
  }
}

export const WorkoutExercisesBuilder: React.FC<WorkoutExercisesBuilderProps> = ({
  items,
  onChange,
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [schemes, setSchemes] = useState<ExerciseScheme[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de busca de exercícios
  const [search, setSearch] = useState('');
  const [mgFilter, setMgFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modal de configuração de execução (ao adicionar ou editar exercício da lista)
  const [configTarget, setConfigTarget] = useState<{
    mode: 'add' | 'edit';
    exercise: Exercise;
    editIndex?: number;
  } | null>(null);

  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [schemeType, setSchemeType] = useState<SchemeType>('series_retas');
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<string>('10');
  const [repUnit, setRepUnit] = useState<RepUnit>('reps');
  const [restTime, setRestTime] = useState<string>('60');
  const [restUnit, setRestUnit] = useState<RestUnit>('seconds');
  const [notes, setNotes] = useState<string>('');

  // Opção de salvar esquema manual como pré-definido
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [savingPresetOnly, setSavingPresetOnly] = useState(false);
  const [presetSavedFeedback, setPresetSavedFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoadingCatalog(true);
    try {
      const [exRes, mgRes, catRes, schRes] = await Promise.all([
        apiFetch<Exercise[]>('/api/org/exercises'),
        apiFetch<MuscleGroup[]>('/api/org/muscle-groups'),
        apiFetch<ExerciseCategory[]>('/api/org/exercise-categories'),
        apiFetch<ExerciseScheme[]>('/api/org/exercise-schemes'),
      ]);
      setExercises(exRes);
      setMuscleGroups(mgRes);
      setCategories(catRes);
      setSchemes(schRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredExercises = useMemo(() => {
    const t = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!mgFilter || e.muscle_group_id === mgFilter) &&
        (!catFilter || e.category_id === catFilter) &&
        (!onlyFavorites || e.is_favorite) &&
        (!t ||
          e.name.toLowerCase().includes(t) ||
          (e.muscle_group_name || '').toLowerCase().includes(t) ||
          (e.category_name || '').toLowerCase().includes(t))
    );
  }, [exercises, search, mgFilter, catFilter, onlyFavorites]);

  const suggestedName = useMemo(
    () => buildSuggestedSchemeName(schemeType, sets, reps, repUnit),
    [schemeType, sets, reps, repUnit]
  );

  // Abrir modal para adicionar exercício do catálogo
  const openAddExerciseConfig = (ex: Exercise) => {
    setError(null);
    setPresetSavedFeedback(null);
    setSaveAsPreset(false);

    const defaultScheme = schemes[0];
    if (defaultScheme) {
      setSelectedSchemeId(defaultScheme.id);
      setSchemeType(defaultScheme.scheme_type);
      setSets(defaultScheme.sets);
      setReps(defaultScheme.reps);
      setRepUnit(defaultScheme.rep_unit);
      setRestTime(defaultScheme.rest_time ?? '60');
      setRestUnit(defaultScheme.rest_unit || 'seconds');
      setCustomPresetName(defaultScheme.name);
    } else {
      setSelectedSchemeId(null);
      setSchemeType('series_retas');
      setSets(3);
      setReps('10');
      setRepUnit('reps');
      setRestTime('60');
      setRestUnit('seconds');
      setCustomPresetName('3x10');
    }
    setNotes('');
    setConfigTarget({ mode: 'add', exercise: ex });
  };

  // Abrir modal para editar a execução de um exercício já na lista
  const openEditItemConfig = (index: number) => {
    const item = items[index];
    if (!item) return;
    setError(null);
    setPresetSavedFeedback(null);
    setSaveAsPreset(false);

    const foundEx = exercises.find((e) => e.id === item.exercise_id) || {
      id: item.exercise_id,
      organization_id: '',
      name: item.exercise_name,
      media_type: item.media_type || 'none',
      media_url: item.media_url || null,
      muscle_group_id: item.muscle_group_id || '',
      muscle_group_name: item.muscle_group_name || '',
      category_id: item.category_id || '',
      category_name: item.category_name || '',
      is_favorite: Boolean(item.is_favorite),
    };

    setSelectedSchemeId(item.scheme_id || null);
    setSchemeType(item.scheme_type || 'series_retas');
    setSets(item.sets || 3);
    setReps(item.reps || '10');
    setRepUnit(item.rep_unit || 'reps');
    setRestTime(item.rest_time ?? '60');
    setRestUnit(item.rest_unit || 'seconds');
    setNotes(item.notes || '');
    setCustomPresetName(item.scheme_name || '');
    setConfigTarget({ mode: 'edit', exercise: foundEx, editIndex: index });
  };

  // Selecionar uma cápsula de esquema pré-definido
  const handleSelectCapsule = (s: ExerciseScheme) => {
    setSelectedSchemeId(s.id);
    setSchemeType(s.scheme_type);
    setSets(s.sets);
    setReps(s.reps);
    setRepUnit(s.rep_unit);
    setRestTime(s.rest_time ?? '60');
    setRestUnit(s.rest_unit || 'seconds');
    setSaveAsPreset(false);
    setPresetSavedFeedback(null);
  };

  // Alterações manuais desmarcam a cápsula ativa e atualizam a sugestão
  const handleManualChange = (
    nextType: SchemeType,
    nextSets: number,
    nextReps: string,
    nextUnit: RepUnit
  ) => {
    setSelectedSchemeId(null);
    setSchemeType(nextType);
    setSets(nextSets);
    setReps(nextReps);
    setRepUnit(nextUnit);
    setPresetSavedFeedback(null);
  };

  // Salvar esquema manualmente agora (botão rápido ou ao confirmar)
  const persistSchemeToBackend = async (): Promise<ExerciseScheme | null> => {
    const finalName = (customPresetName.trim() || suggestedName).trim();
    const saved = await apiFetch<ExerciseScheme>('/api/org/exercise-schemes', {
      method: 'POST',
      body: JSON.stringify({
        name: finalName,
        scheme_type: schemeType,
        sets,
        reps: reps.trim() || '10',
        rep_unit: repUnit,
        rest_time: restTime.trim(),
        rest_unit: restUnit,
      }),
    });
    setSchemes((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      return exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [...prev, saved];
    });
    return saved;
  };

  const handleSavePresetNow = async () => {
    setSavingPresetOnly(true);
    setError(null);
    try {
      const saved = await persistSchemeToBackend();
      if (saved) {
        setSelectedSchemeId(saved.id);
        setSaveAsPreset(false);
        setPresetSavedFeedback(`Esquema "${saved.name}" salvo nas cápsulas!`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPresetOnly(false);
    }
  };

  const handleDeleteScheme = async (e: React.MouseEvent, scheme: ExerciseScheme) => {
    e.stopPropagation();
    if (!window.confirm(`Remover o esquema pré-definido "${scheme.name}"?`)) return;
    try {
      await apiFetch(`/api/org/exercise-schemes/${scheme.id}`, { method: 'DELETE' });
      setSchemes((prev) => prev.filter((s) => s.id !== scheme.id));
      if (selectedSchemeId === scheme.id) {
        setSelectedSchemeId(null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirmExerciseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configTarget) return;

    const cleanReps = reps.trim() || (schemeType === 'ate_a_falha' ? 'Falha' : '10');
    const cleanSets = Math.max(1, Number(sets) || 3);

    let activeSchemeId = selectedSchemeId;
    let activeSchemeName =
      schemes.find((s) => s.id === selectedSchemeId)?.name ||
      buildSuggestedSchemeName(schemeType, cleanSets, cleanReps, repUnit);

    if (saveAsPreset) {
      try {
        const saved = await persistSchemeToBackend();
        if (saved) {
          activeSchemeId = saved.id;
          activeSchemeName = saved.name;
        }
      } catch (err: any) {
        setError(err.message);
        return;
      }
    }

    const ex = configTarget.exercise;
    const newItem: WorkoutExerciseItem = {
      exercise_id: ex.id,
      exercise_name: ex.name,
      media_type: ex.media_type,
      media_url: ex.media_url,
      muscle_group_id: ex.muscle_group_id,
      muscle_group_name: ex.muscle_group_name,
      category_id: ex.category_id,
      category_name: ex.category_name,
      is_favorite: ex.is_favorite,
      scheme_id: activeSchemeId,
      scheme_name: activeSchemeName,
      scheme_type: schemeType,
      sets: cleanSets,
      reps: cleanReps,
      rep_unit: repUnit,
      rest_time: restTime.trim() || null,
      rest_unit: restUnit,
      notes: notes.trim() || null,
    };

    if (configTarget.mode === 'edit' && typeof configTarget.editIndex === 'number') {
      const next = [...items];
      next[configTarget.editIndex] = newItem;
      onChange(next);
    } else {
      onChange([...items, newItem]);
    }

    setConfigTarget(null);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onChange(next);
  };

  const duplicateItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    const next = [...items];
    next.splice(index + 1, 0, { ...item });
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <ErrorBox error={error} onClose={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================
            COLUNA ESQUERDA: CATÁLOGO E BUSCA DE EXERCÍCIOS
           ================================================================= */}
        <div className={`lg:col-span-5 ${cardCls} p-4 space-y-3.5`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Catálogo de Exercícios
              </h4>
              <p className="text-xs text-slate-500">
                Busque e clique em adicionar para definir séries e repetições
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredExercises.length} disp.
            </span>
          </div>

          {/* Busca por Nome e Botão Favoritos */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="search"
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-9 py-2 text-xs`}
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              title="Filtrar apenas exercícios favoritos"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer shrink-0 ${
                onlyFavorites
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
              Favoritos
            </button>
          </div>

          {/* Filtros por Grupo Muscular e Categoria */}
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Filtrar por grupo muscular"
              value={mgFilter}
              onChange={(e) => setMgFilter(e.target.value)}
              className={`${inputCls} py-2 text-xs`}
            >
              <option value="">Grupo muscular: Todos</option>
              {muscleGroups.map((mg) => (
                <option key={mg.id} value={mg.id}>
                  {mg.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por categoria"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className={`${inputCls} py-2 text-xs`}
            >
              <option value="">Categoria: Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lista de exercícios */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl">
            {loadingCatalog && (
              <div className="p-6 text-center text-xs text-slate-400">
                Carregando exercícios...
              </div>
            )}

            {!loadingCatalog && filteredExercises.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <p>Nenhum exercício encontrado para os filtros informados.</p>
                {(search || mgFilter || catFilter || onlyFavorites) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setMgFilter('');
                      setCatFilter('');
                      setOnlyFavorites(false);
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}

            {!loadingCatalog &&
              filteredExercises.map((ex) => {
                const ytId = ex.media_type === 'youtube' ? extractYoutubeId(ex.media_url) : null;
                const countInList = items.filter((i) => i.exercise_id === ex.id).length;

                return (
                  <div
                    key={ex.id}
                    className="p-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {ex.media_type === 'photo_gif' && ex.media_url ? (
                        <img
                          src={ex.media_url}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : ex.media_type === 'youtube' && ytId ? (
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          <Dumbbell className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {ex.is_favorite && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {ex.name}
                          </span>
                          {countInList > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {countInList}x
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {ex.muscle_group_name}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {ex.category_name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAddExerciseConfig(ex)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* =================================================================
            COLUNA DIREITA: LISTA DE EXERCÍCIOS DO TREINO
           ================================================================= */}
        <div className={`lg:col-span-7 ${cardCls} p-4 space-y-3.5`}>
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Lista de Exercícios do Treino ({items.length})
              </h4>
              <p className="text-xs text-slate-500">
                Clique na cápsula de execução de qualquer exercício para ajustar séries/repetições
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-14 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nenhum exercício adicionado ainda
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Utilize o catálogo ao lado para pesquisar por nome, grupo muscular, categoria ou favoritos e adicione exercícios ao treino.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const schemeMeta =
                  SCHEME_TYPES_INFO[item.scheme_type] || SCHEME_TYPES_INFO.series_retas;
                return (
                  <div
                    key={`${item.exercise_id}-${idx}`}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-emerald-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {/* Ordem e setas */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, -1)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => moveItem(idx, 1)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {item.exercise_name}
                          </span>
                          {item.muscle_group_name && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {item.muscle_group_name}
                            </span>
                          )}
                          {item.category_name && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {item.category_name}
                            </span>
                          )}
                        </div>

                        {/* Cápsula de Execução (clicável para editar) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditItemConfig(idx)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer hover:opacity-90 transition ${schemeMeta.badgeCls}`}
                            title="Clique para alterar séries/repetições"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{formatSchemeSummary(item)}</span>
                            <Pencil className="w-3 h-3 ml-0.5 opacity-70" />
                          </button>

                          {item.notes && (
                            <span className="text-xs text-slate-500 italic truncate max-w-xs">
                              Obs: {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditItemConfig(idx)}
                        className={btnIcon}
                        title="Editar execução (séries/repetições)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateItem(idx)}
                        className={btnIcon}
                        title="Duplicar exercício na lista"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className={`${btnIcon} hover:text-rose-600`}
                        title="Remover exercício da lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL DE EXECUÇÃO DO EXERCÍCIO (CÁPSULAS + CONFIGURAÇÃO MANUAL)
         ===================================================================== */}
      {configTarget && (
        <Modal
          title={
            configTarget.mode === 'add'
              ? `Execução — ${configTarget.exercise.name}`
              : `Editar Execução — ${configTarget.exercise.name}`
          }
          onClose={() => setConfigTarget(null)}
        >
          <form onSubmit={handleConfirmExerciseConfig} className="space-y-5">
            {/* 1. Cápsulas de Seleção Rápida (Esquemas Pré-definidos) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Esquemas Pré-definidos (Seleção Rápida)
                </label>
                <span className="text-[11px] text-slate-400">
                  Clique em uma cápsula para preencher
                </span>
              </div>

              <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 max-h-40 overflow-y-auto">
                {schemes.map((s) => {
                  const isSelected = selectedSchemeId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectCapsule(s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleSelectCapsule(s);
                      }}
                      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span>{s.name}</span>
                      {!s.is_default && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteScheme(e, s)}
                          title="Excluir este esquema salvo"
                          className={`ml-0.5 p-0.5 rounded-full hover:bg-rose-500 hover:text-white transition ${
                            isSelected ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Tipo de Esquema + Help Contextual */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tipo de Esquema
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SCHEME_TYPE_KEYS.map((typeKey) => {
                  const info = SCHEME_TYPES_INFO[typeKey];
                  const active = schemeType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => {
                        let nextReps = reps;
                        if (typeKey === 'piramide' && !reps.includes('-') && !reps.includes('/')) {
                          nextReps = '12-10-8-6';
                        } else if (typeKey === 'ate_a_falha' && reps === '10') {
                          nextReps = 'Até a falha';
                        } else if (
                          typeKey !== 'piramide' &&
                          typeKey !== 'ate_a_falha' &&
                          (reps === '12-10-8-6' || reps.toLowerCase().includes('falha'))
                        ) {
                          nextReps = '10';
                        }
                        handleManualChange(
                          typeKey,
                          typeKey === 'piramide' && sets === 3 ? 4 : sets,
                          nextReps,
                          repUnit
                        );
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>

              {/* Help do tipo de esquema selecionado */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{SCHEME_TYPES_INFO[schemeType].label}: </span>
                  <span>{SCHEME_TYPES_INFO[schemeType].help}</span>
                </div>
              </div>
            </div>

            {/* 3. Séries, Unidade (Quantidade / Segundos / Minutos) e Repetições */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Número de Séries */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Séries *
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleManualChange(schemeType, Math.max(1, sets - 1), reps, repUnit)}
                    className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={sets}
                    onChange={(e) =>
                      handleManualChange(
                        schemeType,
                        Math.max(1, parseInt(e.target.value || '1', 10)),
                        reps,
                        repUnit
                      )
                    }
                    className={`${inputCls} text-center font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => handleManualChange(schemeType, sets + 1, reps, repUnit)}
                    className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unidade da Repetição: Quantidade vs Segundos vs Minutos */}
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Medida da Repetição *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'reps', label: 'Quantidade', icon: Hash },
                      { key: 'seconds', label: 'Segundos', icon: Clock },
                      { key: 'minutes', label: 'Minutos', icon: Clock },
                    ] as const
                  ).map((u) => {
                    const active = repUnit === u.key;
                    const Icon = u.icon;
                    return (
                      <button
                        key={u.key}
                        type="button"
                        onClick={() => {
                          let nextReps = reps;
                          if (u.key === 'seconds' && (reps === '10' || reps === '12')) nextReps = '45';
                          if (u.key === 'minutes' && (reps === '10' || reps === '45')) nextReps = '1';
                          if (u.key === 'reps' && (reps === '45' || reps === '1')) nextReps = '10';
                          handleManualChange(schemeType, sets, nextReps, u.key);
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Campo de Repetições / Tempo + Observação opcional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label={
                  repUnit === 'seconds'
                    ? 'Tempo em Segundos por Série *'
                    : repUnit === 'minutes'
                    ? 'Tempo em Minutos por Série *'
                    : schemeType === 'piramide'
                    ? 'Repetições por Série (ex: 12-10-8-6) *'
                    : 'Repetições *'
                }
              >
                <input
                  type="text"
                  required
                  placeholder={
                    schemeType === 'piramide'
                      ? 'Ex: 12-10-8-6'
                      : repUnit === 'seconds'
                      ? 'Ex: 45'
                      : repUnit === 'minutes'
                      ? 'Ex: 1'
                      : 'Ex: 10 ou 10-12'
                  }
                  value={reps}
                  onChange={(e) => handleManualChange(schemeType, sets, e.target.value, repUnit)}
                  className={inputCls}
                />
              </Field>

              <Field label="Observações (Opcional)">
                <input
                  type="text"
                  placeholder="Ex: Cadência controlada, amplitude máxima..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Tempo de Descanso entre as Séries */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Tempo de Descanso entre as Séries
                </label>

                {/* Atalhos rápidos de descanso */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: 'Sem desc.', val: '0', unit: 'seconds' as RestUnit },
                    { label: '15s', val: '15', unit: 'seconds' as RestUnit },
                    { label: '30s', val: '30', unit: 'seconds' as RestUnit },
                    { label: '45s', val: '45', unit: 'seconds' as RestUnit },
                    { label: '60s', val: '60', unit: 'seconds' as RestUnit },
                    { label: '90s', val: '90', unit: 'seconds' as RestUnit },
                    { label: '2 min', val: '2', unit: 'minutes' as RestUnit },
                  ].map((q) => {
                    const isQuickActive = restTime.trim() === q.val && restUnit === q.unit;
                    return (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          setRestTime(q.val);
                          setRestUnit(q.unit);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                          isQuickActive
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="Ex: 60 (ou 0 para sem descanso)"
                    value={restTime}
                    onChange={(e) => setRestTime(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-6 grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: 'seconds', label: 'Segundos' },
                      { key: 'minutes', label: 'Minutos' },
                    ] as const
                  ).map((u) => {
                    const active = restUnit === u.key;
                    return (
                      <button
                        key={u.key}
                        type="button"
                        onClick={() => setRestUnit(u.key)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Salvar Esquema Manual para usar como pré-definido posteriormente */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsPreset}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSaveAsPreset(checked);
                      if (checked && !customPresetName.trim()) {
                        setCustomPresetName(suggestedName);
                      }
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <BookmarkPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Salvar este esquema para usar como pré-definido posteriormente
                  </span>
                </label>

                {presetSavedFeedback && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <BookmarkCheck className="w-4 h-4" />
                    {presetSavedFeedback}
                  </span>
                )}
              </div>

              {saveAsPreset && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={`Nome da cápsula (ex: ${suggestedName})`}
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    className={`${inputCls} text-xs flex-1`}
                  />
                  <button
                    type="button"
                    disabled={savingPresetOnly}
                    onClick={handleSavePresetNow}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold hover:opacity-90 transition cursor-pointer shrink-0"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    {savingPresetOnly ? 'Salvando...' : 'Salvar cápsula agora'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                Resumo:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatSchemeSummary({
                    scheme_type: schemeType,
                    sets: Math.max(1, Number(sets) || 3),
                    reps: reps.trim() || '10',
                    rep_unit: repUnit,
                    rest_time: restTime.trim(),
                    rest_unit: restUnit,
                  })}
                </strong>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfigTarget(null)}
                  className={btnGhost}
                >
                  Cancelar
                </button>
                <button type="submit" className={btnPrimary}>
                  {configTarget.mode === 'add' ? 'Confirmar e Adicionar' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
