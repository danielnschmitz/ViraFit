import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Dumbbell,
  ExternalLink,
  Eye,
  Filter,
  GraduationCap,
  Layers,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DAYS_OF_WEEK_SHORT,
  Organization,
  PersonalScheduledWorkoutItem,
  SCHEME_TYPES_INFO,
  StudentGroup,
  apiFetch,
  formatSchemeSummary,
} from '../api';
import {
  ErrorBox,
  Field,
  LoadingState,
  Modal,
  btnGhost,
  btnIcon,
  btnPrimary,
  cardCls,
  inputCls,
} from './ui';

interface PersonalScheduleModuleProps {
  org: Organization;
  onNavigateToStudent?: (studentId: string) => void;
}

function formatDatePtBr(isoDate?: string | null): string {
  if (!isoDate) return '';
  const clean = isoDate.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function sanitizePhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Se não tiver código de país, adiciona 55 (Brasil)
  if (digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

export const PersonalScheduleModule: React.FC<PersonalScheduleModuleProps> = ({
  org,
  onNavigateToStudent,
}) => {
  const [workouts, setWorkouts] = useState<PersonalScheduledWorkoutItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'afternoon' | 'night' | 'no_time'>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Modal de Detalhes
  const [inspectingWorkout, setInspectingWorkout] = useState<PersonalScheduledWorkoutItem | null>(null);

  const todayIndex = new Date().getDay(); // 0 = Domingo, 1 = Segunda, etc.

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduleRes, groupsRes] = await Promise.all([
        apiFetch<PersonalScheduledWorkoutItem[]>('/api/org/personal-schedule'),
        apiFetch<StudentGroup[]>('/api/org/student-groups'),
      ]);
      setWorkouts(scheduleRes);
      setGroups(groupsRes);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar agenda do personal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtragem dos treinos agendados
  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return workouts.filter((wk) => {
      // Filtro de busca (nome do aluno, telefone ou nome do treino)
      if (q) {
        const matchStudent = wk.student_name.toLowerCase().includes(q);
        const matchWorkout = wk.name.toLowerCase().includes(q);
        const matchPhone = (wk.student_phone || '').includes(q);
        if (!matchStudent && !matchWorkout && !matchPhone) return false;
      }

      // Filtro de grupo de aluno
      if (selectedGroup && (wk.student_group_name || '').toLowerCase() !== selectedGroup.toLowerCase()) {
        return false;
      }

      // Filtro por dia da semana selecionado (quando em modo focado)
      if (selectedDayFilter !== 'all' && wk.day_of_week !== selectedDayFilter) {
        return false;
      }

      // Filtro por turno / horário
      if (selectedShift !== 'all') {
        const time = wk.scheduled_time;
        if (!time) {
          return selectedShift === 'no_time';
        }
        const hour = parseInt(time.split(':')[0], 10);
        if (selectedShift === 'morning' && (hour >= 12 || isNaN(hour))) return false;
        if (selectedShift === 'afternoon' && (hour < 12 || hour >= 18 || isNaN(hour))) return false;
        if (selectedShift === 'night' && (hour < 18 || isNaN(hour))) return false;
        if (selectedShift === 'no_time') return false;
      }

      return true;
    });
  }, [workouts, search, selectedGroup, selectedDayFilter, selectedShift]);

  // Métricas rápidas
  const metrics = useMemo(() => {
    const uniqueStudents = new Set(workouts.map((w) => w.student_id));
    const todayWorkouts = workouts.filter((w) => w.day_of_week === todayIndex);
    const withTimeCount = workouts.filter((w) => Boolean(w.scheduled_time)).length;

    return {
      totalWorkouts: workouts.length,
      totalStudents: uniqueStudents.size,
      todayWorkoutsCount: todayWorkouts.length,
      withTimeCount,
    };
  }, [workouts, todayIndex]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Agenda do Personal
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Alunos com Dias Fixos
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visualização consolidada de todos os treinos semanais programados para seus alunos com horário e dias fixos.
          </p>
        </div>

        {/* Alternância de Modo de Visualização */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grade Semanal
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Lista Cronológica
          </button>
        </div>
      </div>

      <ErrorBox error={error} onClose={() => setError(null)} />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Treinos na Semana
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.totalWorkouts}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Distribuídos de Dom a Sáb
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Alunos Ativos na Agenda
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.totalStudents}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Formato "Dias fixos"
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Treinos de Hoje ({DAYS_OF_WEEK_SHORT[todayIndex]})
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.todayWorkoutsCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Programados para {DAYS_OF_WEEK[todayIndex]}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Com Horário Marcado
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.withTimeCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Horários de execução definidos
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={`${cardCls} p-4 space-y-3`}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar aluno ou treino"
              placeholder="Buscar por nome do aluno, telefone ou nome do treino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>

          <select
            aria-label="Filtrar por grupo"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
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
            aria-label="Filtrar por turno ou horário"
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value as any)}
            className={`${inputCls} sm:w-48`}
          >
            <option value="all">Todos os horários</option>
            <option value="morning">Manhã (antes de 12:00)</option>
            <option value="afternoon">Tarde (12:00 às 18:00)</option>
            <option value="night">Noite (a partir de 18:00)</option>
            <option value="no_time">Sem horário marcado</option>
          </select>
        </div>

        {/* Pílulas de filtro por dia da semana */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Dias:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedDayFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semana Inteira
          </button>
          {DAYS_OF_WEEK.map((dayName, idx) => {
            const isToday = idx === todayIndex;
            const countForDay = workouts.filter((w) => w.day_of_week === idx).length;
            const isSelected = selectedDayFilter === idx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDayFilter(idx)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isToday
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{DAYS_OF_WEEK_SHORT[idx]}</span>
                {isToday && <span className="text-[10px] font-bold">• Hoje</span>}
                <span className="text-[10px] opacity-70">({countForDay})</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className={cardCls}>
          <LoadingState message="Carregando a agenda semanal do personal..." />
        </div>
      )}

      {/* Estado Vazio */}
      {!loading && workouts.length === 0 && (
        <div className={`${cardCls} p-12 text-center space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">
            Nenhum treino agendado em "Dias fixos da semana"
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Para que os treinos apareçam aqui, acesse a <strong>Gestão de Alunos</strong>, selecione um aluno com agenda definida como <em>"Dias Fixos da Semana"</em> e clique em <strong>"Agendar Treino"</strong>.
          </p>
        </div>
      )}

      {!loading && workouts.length > 0 && filteredWorkouts.length === 0 && (
        <div className={`${cardCls} p-12 text-center space-y-2 text-slate-400`}>
          <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            Nenhum treino encontrado com os filtros selecionados
          </div>
          <p className="text-xs">Tente alterar o termo de busca ou limpar os filtros de grupo e turno.</p>
        </div>
      )}

      {/* MODO 1: GRADE SEMANAL (7 DIAS) */}
      {!loading && viewMode === 'grid' && filteredWorkouts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          {DAYS_OF_WEEK.map((dayName, dayIndex) => {
            if (selectedDayFilter !== 'all' && selectedDayFilter !== dayIndex) {
              return null;
            }

            const dayWorkouts = filteredWorkouts
              .filter((sw) => sw.day_of_week === dayIndex)
              .sort((a, b) =>
                (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99')
              );

            const isToday = dayIndex === todayIndex;
            const isWeekend = dayIndex === 0 || dayIndex === 6;

            return (
              <div
                key={dayIndex}
                className={`flex flex-col rounded-2xl border transition ${
                  isToday
                    ? 'bg-white dark:bg-slate-900 border-emerald-500/80 dark:border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-md'
                    : dayWorkouts.length > 0
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Cabeçalho da Coluna do Dia */}
                <div
                  className={`p-3 border-b rounded-t-2xl flex items-center justify-between gap-1.5 ${
                    isToday
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : isWeekend
                      ? 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                      : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                        isToday ? 'text-white' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      <span>{dayName}</span>
                      {isToday && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-white text-emerald-700">
                          Hoje
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-medium ${
                        isToday ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {dayWorkouts.length === 0
                        ? 'Nenhum treino'
                        : `${dayWorkouts.length} treino(s)`}
                    </div>
                  </div>
                </div>

                {/* Lista de Treinos Agendados no Dia */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[160px]">
                  {dayWorkouts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center text-slate-400">
                      <span className="text-[11px] italic">Sem treinos agendados</span>
                    </div>
                  ) : (
                    dayWorkouts.map((wk) => (
                      <div
                        key={wk.id}
                        onClick={() => setInspectingWorkout(wk)}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 dark:hover:border-emerald-500 transition group flex flex-col justify-between gap-2 shadow-xs cursor-pointer"
                      >
                        <div className="space-y-1.5">
                          {/* Horário de Execução em destaque */}
                          <div className="flex items-center justify-between gap-1">
                            {wk.scheduled_time ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                                <Clock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                {wk.scheduled_time}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                <Clock className="w-2.5 h-2.5" />
                                Horário livre
                              </span>
                            )}

                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                                (wk.student_group_name || '').toLowerCase() === 'online'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {wk.student_group_name || 'Presencial'}
                            </span>
                          </div>

                          {/* Nome do Aluno */}
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate flex items-center gap-1">
                              <User className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{wk.student_name}</span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5 flex items-center gap-1">
                              <Dumbbell className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{wk.name}</span>
                            </div>
                          </div>

                          {/* Exercícios resumo */}
                          {wk.items.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 space-y-0.5">
                              {wk.items.slice(0, 2).map((it, i) => (
                                <div
                                  key={it.id || i}
                                  className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-1"
                                >
                                  <span className="truncate">{it.exercise_name}</span>
                                  <span className="shrink-0 text-[9px] font-bold text-slate-400">
                                    {it.sets}x{it.reps}
                                  </span>
                                </div>
                              ))}
                              {wk.items.length > 2 && (
                                <div className="text-[9px] text-slate-400 italic">
                                  +{wk.items.length - 2} exercícios...
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{wk.items.length} exercício(s)</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">
                            Ver detalhes →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODO 2: LISTA / TIMELINE CRONOLÓGICA */}
      {!loading && viewMode === 'timeline' && filteredWorkouts.length > 0 && (
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((dayName, dayIndex) => {
            if (selectedDayFilter !== 'all' && selectedDayFilter !== dayIndex) {
              return null;
            }

            const dayWorkouts = filteredWorkouts
              .filter((sw) => sw.day_of_week === dayIndex)
              .sort((a, b) =>
                (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99')
              );

            if (dayWorkouts.length === 0) return null;

            const isToday = dayIndex === todayIndex;

            return (
              <div key={dayIndex} className={`${cardCls} p-5 space-y-4`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {dayName}
                    </h3>
                    {isToday && (
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                        Hoje
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {dayWorkouts.length} treino(s) agendado(s)
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayWorkouts.map((wk) => (
                    <div
                      key={wk.id}
                      onClick={() => setInspectingWorkout(wk)}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-16 shrink-0">
                          {wk.scheduled_time ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                              <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {wk.scheduled_time}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Sem horário
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                              {wk.student_name}
                            </h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                (wk.student_group_name || '').toLowerCase() === 'online'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {wk.student_group_name || 'Presencial'}
                            </span>
                            {wk.student_phone && (
                              <span className="text-xs text-slate-400">
                                {wk.student_phone}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                            <Dumbbell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold">{wk.name}</span>
                            <span>• {wk.items.length} exercício(s)</span>
                            {wk.notes && (
                              <span className="italic text-slate-400 truncate max-w-xs">
                                — {wk.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingWorkout(wk);
                          }}
                          className={btnGhost}
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver Detalhes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE DETALHES DO TREINO AGENDADO */}
      {inspectingWorkout && (
        <Modal
          title={`Treino Agendado — ${inspectingWorkout.student_name}`}
          onClose={() => setInspectingWorkout(null)}
        >
          <div className="space-y-5">
            {/* Informações Principais do Aluno e Horário */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">Aluno</div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {inspectingWorkout.student_name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                    Grupo: {inspectingWorkout.student_group_name || 'Presencial'}
                  </span>
                  {inspectingWorkout.student_gender && (
                    <span className="text-slate-500 text-[11px]">
                      {inspectingWorkout.student_gender}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">
                  Dia & Horário Agendado
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {inspectingWorkout.day_of_week !== null && inspectingWorkout.day_of_week !== undefined
                    ? DAYS_OF_WEEK[inspectingWorkout.day_of_week]
                    : 'Dia a definir'}
                </div>
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium text-xs mt-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {inspectingWorkout.scheduled_time
                    ? `Horário: ${inspectingWorkout.scheduled_time}`
                    : 'Sem horário fixo estipulado'}
                </div>
              </div>

              {/* Contatos */}
              {inspectingWorkout.student_phone && (
                <div className="sm:col-span-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {inspectingWorkout.student_phone}
                    </span>
                  </div>
                  {sanitizePhoneForWhatsApp(inspectingWorkout.student_phone) && (
                    <a
                      href={`https://wa.me/${sanitizePhoneForWhatsApp(inspectingWorkout.student_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Conversar no WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Treino e Exercícios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {inspectingWorkout.name}
                  </h3>
                  {inspectingWorkout.notes && (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      {inspectingWorkout.notes}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {inspectingWorkout.items.length} exercício(s)
                </span>
              </div>

              {/* Lista de Exercícios */}
              {inspectingWorkout.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Nenhum exercício cadastrado para este treino.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {inspectingWorkout.items.map((item, idx) => {
                    const schemeMeta =
                      SCHEME_TYPES_INFO[item.scheme_type] || SCHEME_TYPES_INFO.series_retas;

                    return (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {item.exercise_name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {item.muscle_group_name || ''}
                              {item.category_name ? ` • ${item.category_name}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${schemeMeta.badgeCls}`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            {formatSchemeSummary(item)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé com botões de navegação */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setInspectingWorkout(null)}
                className={btnGhost}
              >
                Fechar
              </button>

              {onNavigateToStudent && (
                <button
                  type="button"
                  onClick={() => {
                    const studentId = inspectingWorkout.student_id;
                    setInspectingWorkout(null);
                    onNavigateToStudent(studentId);
                  }}
                  className={btnPrimary}
                >
                  <User className="w-4 h-4" />
                  Abrir Ficha do Aluno
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
