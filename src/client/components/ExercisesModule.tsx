import React, { useEffect, useMemo, useState } from 'react';
import {
  Dumbbell,
  Film,
  Image as ImageIcon,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
  Check,
} from 'lucide-react';
import {
  Exercise,
  ExerciseCategory,
  MuscleGroup,
  apiFetch,
  extractYoutubeId,
  readFileAsDataUrl,
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

interface ExercisesModuleProps {
  initialSubTab?: 'exercises' | 'muscle_groups' | 'categories';
}

const emptyExercise = {
  name: '',
  media_type: 'none' as Exercise['media_type'],
  media_url: '',
  muscle_group_id: '',
  muscle_group_name: '',
  new_muscle_group_name: '',
  category_id: '',
  category_name: '',
  new_category_name: '',
  is_favorite: false,
};

export const ExercisesModule: React.FC<ExercisesModuleProps> = ({ initialSubTab = 'exercises' }) => {
  const [subTab, setSubTab] = useState<'exercises' | 'muscle_groups' | 'categories'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de Exercícios
  const [search, setSearch] = useState('');
  const [mgFilter, setMgFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modal de Exercício
  const [editingExercise, setEditingExercise] = useState<Exercise | 'new' | null>(null);
  const [exForm, setExForm] = useState(emptyExercise);
  const [creatingNewMgInline, setCreatingNewMgInline] = useState(false);
  const [creatingNewCatInline, setCreatingNewCatInline] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingExercise, setSavingExercise] = useState(false);

  // Preview de mídia em modal
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Estado para Aba 2.1: Grupo Muscular
  const [mgSearch, setMgSearch] = useState('');
  const [newMgName, setNewMgName] = useState('');
  const [editingMgId, setEditingMgId] = useState<string | null>(null);
  const [editingMgValue, setEditingMgValue] = useState('');

  // Estado para Aba 2.2: Categoria de Exercício
  const [catSearch, setCatSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatValue, setEditingCatValue] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [exRes, mgRes, catRes] = await Promise.all([
        apiFetch<Exercise[]>('/api/org/exercises'),
        apiFetch<MuscleGroup[]>('/api/org/muscle-groups'),
        apiFetch<ExerciseCategory[]>('/api/org/exercise-categories'),
      ]);
      setExercises(exRes);
      setMuscleGroups(mgRes);
      setCategories(catRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* -------------------- Lógica 2.3 Exercícios -------------------- */
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

  const openExerciseModal = (ex: Exercise | 'new') => {
    setError(null);
    setCreatingNewMgInline(false);
    setCreatingNewCatInline(false);
    setEditingExercise(ex);
    if (ex === 'new') {
      setExForm({
        ...emptyExercise,
        muscle_group_id: muscleGroups[0]?.id || '',
        muscle_group_name: muscleGroups[0]?.name || '',
        category_id: categories[0]?.id || '',
        category_name: categories[0]?.name || '',
      });
    } else {
      setExForm({
        name: ex.name,
        media_type: ex.media_type || 'none',
        media_url: ex.media_url || '',
        muscle_group_id: ex.muscle_group_id,
        muscle_group_name: ex.muscle_group_name || '',
        new_muscle_group_name: '',
        category_id: ex.category_id,
        category_name: ex.category_name || '',
        new_category_name: '',
        is_favorite: Boolean(ex.is_favorite),
      });
    }
  };

  const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setExForm((prev) => ({ ...prev, media_url: dataUrl }));
    } catch {
      setError('Falha ao ler o arquivo selecionado.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (creatingNewMgInline && !exForm.new_muscle_group_name.trim()) {
      setError('Digite o nome do novo Grupo Muscular.');
      return;
    }
    if (!creatingNewMgInline && !exForm.muscle_group_id) {
      setError('Selecione um Grupo Muscular.');
      return;
    }
    if (creatingNewCatInline && !exForm.new_category_name.trim()) {
      setError('Digite o nome da nova Categoria.');
      return;
    }
    if (!creatingNewCatInline && !exForm.category_id) {
      setError('Selecione uma Categoria.');
      return;
    }

    setSavingExercise(true);
    try {
      const payload = {
        name: exForm.name,
        media_type: exForm.media_type,
        media_url: exForm.media_type === 'none' ? null : exForm.media_url,
        muscle_group_id: creatingNewMgInline ? '' : exForm.muscle_group_id,
        new_muscle_group_name: creatingNewMgInline ? exForm.new_muscle_group_name.trim() : '',
        category_id: creatingNewCatInline ? '' : exForm.category_id,
        new_category_name: creatingNewCatInline ? exForm.new_category_name.trim() : '',
        is_favorite: exForm.is_favorite,
      };

      if (editingExercise && editingExercise !== 'new') {
        await apiFetch(`/api/org/exercises/${editingExercise.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/org/exercises', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setEditingExercise(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingExercise(false);
    }
  };

  const toggleFavorite = async (ex: Exercise) => {
    try {
      const nextFav = !ex.is_favorite;
      setExercises((prev) =>
        prev.map((item) => (item.id === ex.id ? { ...item, is_favorite: nextFav } : item))
      );
      await apiFetch(`/api/org/exercises/${ex.id}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ is_favorite: nextFav }),
      });
    } catch (err: any) {
      setError(err.message);
      loadAll();
    }
  };

  const removeExercise = async (ex: Exercise) => {
    if (!window.confirm(`Deseja realmente excluir o exercício "${ex.name}"?`)) return;
    try {
      await apiFetch(`/api/org/exercises/${ex.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* -------------------- Lógica 2.1 Grupos Musculares -------------------- */
  const filteredMuscleGroups = useMemo(() => {
    const t = mgSearch.trim().toLowerCase();
    return t ? muscleGroups.filter((m) => m.name.toLowerCase().includes(t)) : muscleGroups;
  }, [muscleGroups, mgSearch]);

  const handleAddMuscleGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMgName.trim()) return;
    setError(null);
    try {
      await apiFetch('/api/org/muscle-groups', {
        method: 'POST',
        body: JSON.stringify({ name: newMgName.trim() }),
      });
      setNewMgName('');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateMuscleGroup = async (id: string) => {
    if (!editingMgValue.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/org/muscle-groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingMgValue.trim() }),
      });
      setEditingMgId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMuscleGroup = async (mg: MuscleGroup) => {
    if ((mg.exercises_count ?? 0) > 0) {
      setError(`O grupo muscular "${mg.name}" possui exercícios vinculados e não pode ser excluído.`);
      return;
    }
    if (!window.confirm(`Excluir o grupo muscular "${mg.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/muscle-groups/${mg.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* -------------------- Lógica 2.2 Categorias de Exercício -------------------- */
  const filteredCategories = useMemo(() => {
    const t = catSearch.trim().toLowerCase();
    return t ? categories.filter((c) => c.name.toLowerCase().includes(t)) : categories;
  }, [categories, catSearch]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setError(null);
    try {
      await apiFetch('/api/org/exercise-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setNewCatName('');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCatValue.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/org/exercise-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingCatValue.trim() }),
      });
      setEditingCatId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCategory = async (cat: ExerciseCategory) => {
    if ((cat.exercises_count ?? 0) > 0) {
      setError(`A categoria "${cat.name}" possui exercícios vinculados e não pode ser excluída.`);
      return;
    }
    if (!window.confirm(`Excluir a categoria "${cat.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/exercise-categories/${cat.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Sub-navegação do Módulo de Exercícios */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Módulo de Exercícios</h1>
          <p className="text-sm text-slate-500">
            Biblioteca de exercícios, grupos musculares e categorias de treino.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('exercises')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'exercises'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            Exercícios ({exercises.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('muscle_groups')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'muscle_groups'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Grupos Musculares ({muscleGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'categories'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Tags className="w-3.5 h-3.5" />
            Categorias ({categories.length})
          </button>
        </div>
      </div>

      <ErrorBox error={error} onClose={() => setError(null)} />

      {/* =====================================================================
          SUB-ABA 2.3: CADASTRO DE EXERCÍCIOS
         ===================================================================== */}
      {subTab === 'exercises' && (
        <div className="space-y-4">
          <div className={`${cardCls} p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center`}>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="search"
                aria-label="Buscar exercício"
                placeholder="Buscar exercício por nome, grupo muscular ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>

            <select
              aria-label="Filtrar por grupo muscular"
              value={mgFilter}
              onChange={(e) => setMgFilter(e.target.value)}
              className={`${inputCls} lg:w-48`}
            >
              <option value="">Todos os grupos musc.</option>
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
              className={`${inputCls} lg:w-44`}
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                onlyFavorites
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-4 h-4 ${onlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
              Favoritos
            </button>

            <button type="button" className={btnPrimary} onClick={() => openExerciseModal('new')}>
              <Plus className="w-4 h-4" /> Novo Exercício
            </button>
          </div>

          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">Fav</th>
                  <th className="text-left px-4 py-3.5">Exercício</th>
                  <th className="text-left px-4 py-3.5">Grupo Muscular</th>
                  <th className="text-left px-4 py-3.5">Categoria</th>
                  <th className="text-left px-4 py-3.5">Mídia</th>
                  <th className="px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <LoadingState message="Carregando exercícios..." />
                    </td>
                  </tr>
                )}
                {!loading && filteredExercises.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Dumbbell className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                        <span>Nenhum exercício cadastrado para os filtros selecionados.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredExercises.map((ex) => {
                    const ytId = ex.media_type === 'youtube' ? extractYoutubeId(ex.media_url) : null;
                    return (
                      <tr key={ex.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(ex)}
                            aria-label={ex.is_favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Star
                              className={`w-4 h-4 transition ${
                                ex.is_favorite
                                  ? 'fill-amber-400 text-amber-500 scale-110'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {ex.media_type === 'photo_gif' && ex.media_url ? (
                              <img
                                src={ex.media_url}
                                alt={ex.name}
                                onClick={() => setPreviewExercise(ex)}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80"
                              />
                            ) : ex.media_type === 'youtube' && ytId ? (
                              <img
                                src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                alt={ex.name}
                                onClick={() => setPreviewExercise(ex)}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                <Dumbbell className="w-4 h-4" />
                              </div>
                            )}
                            <span className="font-semibold text-slate-900 dark:text-white">{ex.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {ex.muscle_group_name}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {ex.category_name}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {ex.media_type === 'photo_gif' && ex.media_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewExercise(ex)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              Ver Foto/GIF
                            </button>
                          ) : ex.media_type === 'video' && ex.media_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewExercise(ex)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <Film className="w-3.5 h-3.5" />
                              Assistir Vídeo
                            </button>
                          ) : ex.media_type === 'youtube' && ex.media_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewExercise(ex)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              YouTube
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Sem mídia</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className={btnIcon}
                            onClick={() => openExerciseModal(ex)}
                            aria-label="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className={`${btnIcon} hover:text-rose-600`}
                            onClick={() => removeExercise(ex)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-ABA 2.1: CADASTRO DE GRUPO MUSCULAR
         ===================================================================== */}
      {subTab === 'muscle_groups' && (
        <div className="space-y-4">
          <div className={`${cardCls} p-5 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cadastro de Grupo Muscular
              </h2>
              <p className="text-xs text-slate-500">
                Adicione novos grupos musculares, edite nomes ou exclua grupos que não estejam vinculados a nenhum exercício.
              </p>
            </div>

            <form onSubmit={handleAddMuscleGroup} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder="Nome do novo grupo muscular..."
                value={newMgName}
                onChange={(e) => setNewMgName(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button type="submit" className={btnPrimary}>
                <Plus className="w-4 h-4" /> Cadastrar Grupo Muscular
              </button>
            </form>
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="search"
                  placeholder="Filtrar grupos musculares..."
                  value={mgSearch}
                  onChange={(e) => setMgSearch(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredMuscleGroups.length} registro(s)
              </span>
            </div>

            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left px-5 py-3">Nome do Grupo Muscular</th>
                  <th className="text-left px-4 py-3">Exercícios Vinculados</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMuscleGroups.map((mg) => {
                  const isEditing = editingMgId === mg.id;
                  const hasChildren = (mg.exercises_count ?? 0) > 0;
                  return (
                    <tr key={mg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type="text"
                              autoFocus
                              value={editingMgValue}
                              onChange={(e) => setEditingMgValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateMuscleGroup(mg.id);
                                if (e.key === 'Escape') setEditingMgId(null);
                              }}
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateMuscleGroup(mg.id)}
                              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                              title="Salvar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMgId(null)}
                              className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900 dark:text-white">{mg.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {mg.exercises_count ?? 0} exercício(s)
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMgId(mg.id);
                            setEditingMgValue(mg.name);
                          }}
                          className={btnIcon}
                          title="Editar nome"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={hasChildren}
                          onClick={() => handleDeleteMuscleGroup(mg)}
                          className={`${btnIcon} ${
                            hasChildren
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:text-rose-600'
                          }`}
                          title={
                            hasChildren
                              ? 'Não pode ser excluído pois possui exercícios associados'
                              : 'Excluir grupo muscular'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-ABA 2.2: CADASTRO DE CATEGORIA DE EXERCÍCIO
         ===================================================================== */}
      {subTab === 'categories' && (
        <div className="space-y-4">
          <div className={`${cardCls} p-5 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cadastro de Categoria de Exercício
              </h2>
              <p className="text-xs text-slate-500">
                Adicione novas categorias, edite nomes ou exclua categorias que não estejam vinculadas a nenhum exercício.
              </p>
            </div>

            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder="Nome da nova categoria..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button type="submit" className={btnPrimary}>
                <Plus className="w-4 h-4" /> Cadastrar Categoria
              </button>
            </form>
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="search"
                  placeholder="Filtrar categorias..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredCategories.length} registro(s)
              </span>
            </div>

            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left px-5 py-3">Nome da Categoria</th>
                  <th className="text-left px-4 py-3">Exercícios Vinculados</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategories.map((cat) => {
                  const isEditing = editingCatId === cat.id;
                  const hasChildren = (cat.exercises_count ?? 0) > 0;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type="text"
                              autoFocus
                              value={editingCatValue}
                              onChange={(e) => setEditingCatValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateCategory(cat.id);
                                if (e.key === 'Escape') setEditingCatId(null);
                              }}
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCategory(cat.id)}
                              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                              title="Salvar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900 dark:text-white">{cat.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {cat.exercises_count ?? 0} exercício(s)
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(cat.id);
                            setEditingCatValue(cat.name);
                          }}
                          className={btnIcon}
                          title="Editar nome"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={hasChildren}
                          onClick={() => handleDeleteCategory(cat)}
                          className={`${btnIcon} ${
                            hasChildren
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:text-rose-600'
                          }`}
                          title={
                            hasChildren
                              ? 'Não pode ser excluída pois possui exercícios associados'
                              : 'Excluir categoria'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL CRIAR / EDITAR EXERCÍCIO
         ===================================================================== */}
      {editingExercise && (
        <Modal
          title={editingExercise === 'new' ? 'Novo Exercício' : 'Editar Exercício'}
          onClose={() => setEditingExercise(null)}
        >
          <form onSubmit={handleSaveExercise} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <Field label="Nome do Exercício *" htmlFor="ex-name" className="flex-1">
                <input
                  id="ex-name"
                  required
                  type="text"
                  placeholder="Ex.: Supino Reto com Barra, Agachamento Livre..."
                  value={exForm.name}
                  onChange={(e) => setExForm({ ...exForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>

              {/* Marcar como favorito (checkbox com ícone de estrela) */}
              <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 cursor-pointer select-none hover:border-amber-400 transition">
                <input
                  type="checkbox"
                  checked={exForm.is_favorite}
                  onChange={(e) => setExForm({ ...exForm, is_favorite: e.target.checked })}
                  className="sr-only"
                />
                <Star
                  className={`w-5 h-5 transition ${
                    exForm.is_favorite
                      ? 'fill-amber-400 text-amber-500 scale-110'
                      : 'text-slate-400'
                  }`}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Favorito
                </span>
              </label>
            </div>

            {/* Grupo Muscular e Categoria com busca e opção inline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Field label="Grupo Muscular *">
                  {!creatingNewMgInline ? (
                    <SearchableListbox
                      options={muscleGroups.map((m) => ({ id: m.id, name: m.name }))}
                      value={exForm.muscle_group_id}
                      onChange={(id, name) =>
                        setExForm({
                          ...exForm,
                          muscle_group_id: id,
                          muscle_group_name: name,
                          new_muscle_group_name: '',
                        })
                      }
                      placeholder="Selecione o grupo muscular..."
                      createLabel="Cadastrar Grupo Muscular"
                      onCreateOptionClick={() => {
                        setCreatingNewMgInline(true);
                        setExForm((prev) => ({ ...prev, new_muscle_group_name: '' }));
                      }}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          required
                          placeholder="Digite o nome do novo grupo muscular..."
                          value={exForm.new_muscle_group_name}
                          onChange={(e) =>
                            setExForm({ ...exForm, new_muscle_group_name: e.target.value })
                          }
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => setCreatingNewMgInline(false)}
                          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Voltar para a lista"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="block text-[11px] text-emerald-600 dark:text-emerald-400">
                        Novo grupo muscular será cadastrado ao salvar.
                      </span>
                    </div>
                  )}
                </Field>
              </div>

              <div>
                <Field label="Categoria *">
                  {!creatingNewCatInline ? (
                    <SearchableListbox
                      options={categories.map((c) => ({ id: c.id, name: c.name }))}
                      value={exForm.category_id}
                      onChange={(id, name) =>
                        setExForm({
                          ...exForm,
                          category_id: id,
                          category_name: name,
                          new_category_name: '',
                        })
                      }
                      placeholder="Selecione a categoria..."
                      createLabel="Cadastrar Categoria"
                      onCreateOptionClick={() => {
                        setCreatingNewCatInline(true);
                        setExForm((prev) => ({ ...prev, new_category_name: '' }));
                      }}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          required
                          placeholder="Digite o nome da nova categoria..."
                          value={exForm.new_category_name}
                          onChange={(e) =>
                            setExForm({ ...exForm, new_category_name: e.target.value })
                          }
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => setCreatingNewCatInline(false)}
                          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Voltar para a lista"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="block text-[11px] text-emerald-600 dark:text-emerald-400">
                        Nova categoria será cadastrada ao salvar.
                      </span>
                    </div>
                  )}
                </Field>
              </div>
            </div>

            {/* Seleção do Tipo de Mídia */}
            <Field label="Mídia do Exercício" htmlFor="ex-media-type">
              <select
                id="ex-media-type"
                value={exForm.media_type}
                onChange={(e) =>
                  setExForm({
                    ...exForm,
                    media_type: e.target.value as Exercise['media_type'],
                    media_url: '',
                  })
                }
                className={inputCls}
              >
                <option value="none">Nenhuma mídia</option>
                <option value="photo_gif">Foto/GIF</option>
                <option value="video">Vídeo</option>
                <option value="youtube">Vídeo do YouTube</option>
              </select>
            </Field>

            {/* Opção dinâmica conforme o tipo de mídia */}
            {exForm.media_type === 'photo_gif' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <span className="block text-xs font-semibold uppercase text-slate-500">
                  Upload de Foto ou GIF
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-2xs">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    {uploadingMedia ? 'Carregando arquivo...' : 'Escolher Foto ou GIF'}
                    <input
                      type="file"
                      accept="image/*,.gif"
                      onChange={handleMediaFileUpload}
                      className="hidden"
                    />
                  </label>
                  {exForm.media_url && (
                    <button
                      type="button"
                      onClick={() => setExForm({ ...exForm, media_url: '' })}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      Remover arquivo
                    </button>
                  )}
                </div>
                {exForm.media_url && (
                  <img
                    src={exForm.media_url}
                    alt="Preview"
                    className="max-h-52 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-900 p-1"
                  />
                )}
              </div>
            )}

            {exForm.media_type === 'video' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <span className="block text-xs font-semibold uppercase text-slate-500">
                  Upload de Vídeo
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-2xs">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    {uploadingMedia ? 'Carregando vídeo...' : 'Escolher Arquivo de Vídeo'}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleMediaFileUpload}
                      className="hidden"
                    />
                  </label>
                  {exForm.media_url && (
                    <button
                      type="button"
                      onClick={() => setExForm({ ...exForm, media_url: '' })}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      Remover vídeo
                    </button>
                  )}
                </div>
                {exForm.media_url && (
                  <video
                    src={exForm.media_url}
                    controls
                    className="max-h-60 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-black"
                  />
                )}
              </div>
            )}

            {exForm.media_type === 'youtube' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <Field label="Link do Vídeo do YouTube" htmlFor="ex-yt-url">
                  <input
                    id="ex-yt-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={exForm.media_url}
                    onChange={(e) => setExForm({ ...exForm, media_url: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                {extractYoutubeId(exForm.media_url) && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">
                    <iframe
                      title="YouTube Preview"
                      src={`https://www.youtube.com/embed/${extractYoutubeId(exForm.media_url)}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setEditingExercise(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingExercise || uploadingMedia}
                className={btnPrimary}
              >
                {savingExercise ? 'Salvando...' : 'Salvar Exercício'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE MÍDIA */}
      {previewExercise && (
        <Modal
          title={previewExercise.name}
          onClose={() => setPreviewExercise(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                {previewExercise.muscle_group_name}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {previewExercise.category_name}
              </span>
            </div>

            {previewExercise.media_type === 'photo_gif' && previewExercise.media_url && (
              <div className="flex justify-center bg-slate-950/5 dark:bg-slate-950/50 rounded-2xl p-4">
                <img
                  src={previewExercise.media_url}
                  alt={previewExercise.name}
                  className="max-h-[65vh] rounded-xl object-contain"
                />
              </div>
            )}

            {previewExercise.media_type === 'video' && previewExercise.media_url && (
              <video
                src={previewExercise.media_url}
                controls
                autoPlay
                className="w-full max-h-[65vh] rounded-2xl bg-black"
              />
            )}

            {previewExercise.media_type === 'youtube' && previewExercise.media_url && (
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
                {extractYoutubeId(previewExercise.media_url) ? (
                  <iframe
                    title={previewExercise.name}
                    src={`https://www.youtube.com/embed/${extractYoutubeId(previewExercise.media_url)}?autoplay=1`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <div className="p-8 text-center text-white">
                    <a
                      href={previewExercise.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline"
                    >
                      Abrir vídeo no YouTube ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
