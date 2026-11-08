import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Calendar,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  Play,
  RotateCcw,
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
  ScheduledWorkoutOverride,
  StudentGroup,
  apiFetch,
  formatSchemeSummary,
} from '../api';
import { AttendanceSessionRunner } from './AttendanceSessionRunner';
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

export interface DayAttendanceItem {
  id: string; // único para a listagem
  status: 'scheduled' | 'cancelled' | 'rescheduled_away' | 'rescheduled_here' | 'rescheduled_cancelled' | 'completed';
  workout: PersonalScheduledWorkoutItem;
  dayIndex: number;
  dateStr: string; // 'YYYY-MM-DD'
  scheduledTime?: string | null;
  originalDate?: string;
  targetDate?: string | null;
  targetTime?: string | null;
  overrideNotes?: string | null;
  overrideId?: string;
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

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sanitizePhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
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
  const [overrides, setOverrides] = useState<ScheduledWorkoutOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navegação de Semanas
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'afternoon' | 'night' | 'no_time'>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Modal de Detalhes
  const [inspectingItem, setInspectingItem] = useState<DayAttendanceItem | null>(null);

  // Estado para Cancelamento de Atendimento
  const [cancellingItem, setCancellingItem] = useState<DayAttendanceItem | null>(null);
  const [cancelNotes, setCancelNotes] = useState('');
  const [savingCancel, setSavingCancel] = useState(false);

  // Estado para Reagendamento de Atendimento
  const [reschedulingItem, setReschedulingItem] = useState<DayAttendanceItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Estado para Execução do Atendimento (Jornada Step-by-Step)
  const [runningSessionItem, setRunningSessionItem] = useState<DayAttendanceItem | null>(null);

  // Estrutura das datas da semana selecionada
  const weekDays = useMemo(() => {
    const now = new Date();
    const sunday = getSundayOfWeek(now);
    sunday.setDate(sunday.getDate() + weekOffset * 7);

    const days: {
      dayIndex: number;
      date: Date;
      dateStr: string;
      dayFormatted: string;
      dayName: string;
      isToday: boolean;
    }[] = [];

    const todayStr = formatDateISO(now);

    for (let i = 0; i < 7; i++) {
      const cur = new Date(sunday);
      cur.setDate(sunday.getDate() + i);
      const dateStr = formatDateISO(cur);
      days.push({
        dayIndex: i,
        date: cur,
        dateStr,
        dayFormatted: `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`,
        dayName: DAYS_OF_WEEK[i],
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [weekOffset]);

  const weekStartDate = weekDays[0].dateStr;
  const weekEndDate = weekDays[6].dateStr;

  const loadOverrides = async (start: string, end: string) => {
    try {
      const data = await apiFetch<ScheduledWorkoutOverride[]>(
        `/api/org/scheduled-workout-overrides?startDate=${start}&endDate=${end}`
      );
      setOverrides(data);
    } catch (err: any) {
      console.error('[PersonalSchedule] Erro ao carregar overrides:', err);
    }
  };

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

  useEffect(() => {
    if (weekStartDate && weekEndDate) {
      loadOverrides(weekStartDate, weekEndDate);
    }
  }, [weekStartDate, weekEndDate]);

  // Filtragem básica dos treinos cadastrados
  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return workouts.filter((wk) => {
      if (q) {
        const matchStudent = wk.student_name.toLowerCase().includes(q);
        const matchWorkout = wk.name.toLowerCase().includes(q);
        const matchPhone = (wk.student_phone || '').includes(q);
        if (!matchStudent && !matchWorkout && !matchPhone) return false;
      }

      if (selectedGroup && (wk.student_group_name || '').toLowerCase() !== selectedGroup.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [workouts, search, selectedGroup]);

  // Montagem dos atendimentos reais por dia da semana combinando recorrência + overrides
  const weekAttendanceByDay = useMemo(() => {
    const map = new Map<number, DayAttendanceItem[]>();

    for (const day of weekDays) {
      const items: DayAttendanceItem[] = [];

      // 1. Treinos normais do dia da semana
      for (const wk of filteredWorkouts) {
        if (wk.day_of_week === day.dayIndex) {
          // Checar período de vigência
          if (wk.start_date && day.dateStr < wk.start_date) continue;
          if (wk.end_date && day.dateStr > wk.end_date) continue;

          // Checar se há override para esta data original
          const override = overrides.find(
            (o) => o.scheduled_workout_id === wk.id && o.original_date === day.dateStr
          );

          if (override) {
            if (override.status === 'cancelled') {
              if (override.rescheduled_date && override.rescheduled_date !== day.dateStr) {
                // Foi reagendado para outro dia e lá cancelado
                items.push({
                  id: `${wk.id}_${day.dateStr}_rescheduled_away`,
                  status: 'rescheduled_away',
                  workout: wk,
                  dayIndex: day.dayIndex,
                  dateStr: day.dateStr,
                  scheduledTime: wk.scheduled_time,
                  originalDate: day.dateStr,
                  targetDate: override.rescheduled_date,
                  targetTime: override.rescheduled_time,
                  overrideNotes: override.notes ? `Reagendado e cancelado: ${override.notes}` : 'Reagendado e cancelado no destino',
                  overrideId: override.id,
                });
              } else {
                items.push({
                  id: `${wk.id}_${day.dateStr}_cancelled`,
                  status: 'cancelled',
                  workout: wk,
                  dayIndex: day.dayIndex,
                  dateStr: day.dateStr,
                  scheduledTime: wk.scheduled_time,
                  originalDate: day.dateStr,
                  overrideNotes: override.notes,
                  overrideId: override.id,
                });
              }
            } else if (override.status === 'rescheduled') {
              items.push({
                id: `${wk.id}_${day.dateStr}_rescheduled_away`,
                status: 'rescheduled_away',
                workout: wk,
                dayIndex: day.dayIndex,
                dateStr: day.dateStr,
                scheduledTime: wk.scheduled_time,
                originalDate: day.dateStr,
                targetDate: override.rescheduled_date,
                targetTime: override.rescheduled_time,
                overrideNotes: override.notes,
                overrideId: override.id,
              });
            } else if (override.status === 'completed') {
              items.push({
                id: `${wk.id}_${day.dateStr}_completed`,
                status: 'completed',
                workout: wk,
                dayIndex: day.dayIndex,
                dateStr: day.dateStr,
                scheduledTime: wk.scheduled_time,
                originalDate: day.dateStr,
                overrideNotes: override.notes,
                overrideId: override.id,
              });
            }
          } else {
            items.push({
              id: `${wk.id}_${day.dateStr}`,
              status: 'scheduled',
              workout: wk,
              dayIndex: day.dayIndex,
              dateStr: day.dateStr,
              scheduledTime: wk.scheduled_time,
              originalDate: day.dateStr,
            });
          }
        }
      }

      // 2. Treinos reagendados PARA este dia (vindos de outra data)
      const rescheduledHere = overrides.filter(
        (o) =>
          (o.status === 'rescheduled' || o.status === 'cancelled' || o.status === 'completed') &&
          o.rescheduled_date === day.dateStr
      );

      for (const ov of rescheduledHere) {
        const wk = workouts.find((w) => w.id === ov.scheduled_workout_id);
        if (wk) {
          // Aplicar filtros de busca e grupo também no treino reagendado
          const q = search.trim().toLowerCase();
          if (q) {
            const matchStudent = wk.student_name.toLowerCase().includes(q);
            const matchWorkout = wk.name.toLowerCase().includes(q);
            const matchPhone = (wk.student_phone || '').includes(q);
            if (!matchStudent && !matchWorkout && !matchPhone) continue;
          }
          if (selectedGroup && (wk.student_group_name || '').toLowerCase() !== selectedGroup.toLowerCase()) {
            continue;
          }

          const status: DayAttendanceItem['status'] =
            ov.status === 'completed'
              ? 'completed'
              : ov.status === 'cancelled'
              ? 'rescheduled_cancelled'
              : 'rescheduled_here';

          items.push({
            id: `${wk.id}_${day.dateStr}_${status}`,
            status,
            workout: wk,
            dayIndex: day.dayIndex,
            dateStr: day.dateStr,
            scheduledTime: ov.rescheduled_time || wk.scheduled_time,
            originalDate: ov.original_date,
            overrideNotes: ov.notes,
            overrideId: ov.id,
          });
        }
      }

      // Filtro por turno / horário se selecionado
      const filteredByShift = items.filter((item) => {
        if (selectedShift === 'all') return true;
        const time = item.scheduledTime;
        if (!time) return selectedShift === 'no_time';
        const hour = parseInt(time.split(':')[0], 10);
        if (selectedShift === 'morning' && (hour >= 12 || isNaN(hour))) return false;
        if (selectedShift === 'afternoon' && (hour < 12 || hour >= 18 || isNaN(hour))) return false;
        if (selectedShift === 'night' && (hour < 18 || isNaN(hour))) return false;
        if (selectedShift === 'no_time') return false;
        return true;
      });

      // Ordenar por horário
      filteredByShift.sort((a, b) =>
        (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99')
      );

      map.set(day.dayIndex, filteredByShift);
    }

    return map;
  }, [weekDays, filteredWorkouts, workouts, overrides, search, selectedGroup, selectedShift]);

  // Contagem geral para métricas
  const allWeekItems = useMemo(() => {
    const list: DayAttendanceItem[] = [];
    weekAttendanceByDay.forEach((items) => list.push(...items));
    return list;
  }, [weekAttendanceByDay]);

  const metrics = useMemo(() => {
    const activeItems = allWeekItems.filter(
      (i) => i.status !== 'cancelled' && i.status !== 'rescheduled_away' && i.status !== 'rescheduled_cancelled'
    );
    const uniqueStudents = new Set(activeItems.map((i) => i.workout.student_id));
    const todayIndex = new Date().getDay();
    const todayItems = (weekAttendanceByDay.get(todayIndex) || []).filter(
      (i) => i.status !== 'cancelled' && i.status !== 'rescheduled_away' && i.status !== 'rescheduled_cancelled'
    );
    const withTimeCount = activeItems.filter((i) => Boolean(i.scheduledTime)).length;
    const cancelledCount = allWeekItems.filter(
      (i) => i.status === 'cancelled' || i.status === 'rescheduled_cancelled'
    ).length;

    return {
      totalWorkouts: activeItems.length,
      totalStudents: uniqueStudents.size,
      todayWorkoutsCount: todayItems.length,
      withTimeCount,
      cancelledCount,
    };
  }, [allWeekItems, weekAttendanceByDay]);

  // AÇÕES: Restaurar atendimento para o padrão semanal original
  const handleRestore = async (scheduledWorkoutId: string, originalDate: string) => {
    if (!window.confirm('Deseja restaurar este atendimento para o padrão semanal original?')) return;
    try {
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'DELETE',
        body: JSON.stringify({
          scheduled_workout_id: scheduledWorkoutId,
          original_date: originalDate,
        }),
      });
      await loadOverrides(weekStartDate, weekEndDate);
      setInspectingItem(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao restaurar agendamento original.');
    }
  };

  // AÇÕES: Abrir modal de cancelamento
  const openCancelModal = (item: DayAttendanceItem) => {
    setCancellingItem(item);
    setCancelNotes('');
  };

  // AÇÕES: Confirmar cancelamento
  const handleConfirmCancel = async () => {
    if (!cancellingItem) return;
    setSavingCancel(true);
    try {
      const isRescheduled = cancellingItem.status === 'rescheduled_here' || Boolean(cancellingItem.originalDate);
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'POST',
        body: JSON.stringify({
          scheduled_workout_id: cancellingItem.workout.id,
          student_id: cancellingItem.workout.student_id,
          original_date: cancellingItem.originalDate || cancellingItem.dateStr,
          status: 'cancelled',
          rescheduled_date: isRescheduled ? cancellingItem.dateStr : null,
          rescheduled_time: isRescheduled ? (cancellingItem.scheduledTime || null) : null,
          notes: cancelNotes.trim() || null,
        }),
      });
      setCancellingItem(null);
      setCancelNotes('');
      await loadOverrides(weekStartDate, weekEndDate);
      setInspectingItem(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar atendimento.');
    } finally {
      setSavingCancel(false);
    }
  };

  // AÇÕES: Abrir modal de reagendamento
  const openRescheduleModal = (item: DayAttendanceItem) => {
    setReschedulingItem(item);
    setRescheduleDate(item.dateStr);
    setRescheduleTime(item.scheduledTime || item.workout.scheduled_time || '');
    setRescheduleNotes(item.overrideNotes || '');
  };

  // AÇÕES: Confirmar reagendamento
  const handleConfirmReschedule = async () => {
    if (!reschedulingItem) return;
    if (!rescheduleDate) {
      alert('Informe a nova data para o atendimento.');
      return;
    }
    setSavingReschedule(true);
    try {
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'POST',
        body: JSON.stringify({
          scheduled_workout_id: reschedulingItem.workout.id,
          student_id: reschedulingItem.workout.student_id,
          original_date: reschedulingItem.originalDate || reschedulingItem.dateStr,
          status: 'rescheduled',
          rescheduled_date: rescheduleDate,
          rescheduled_time: rescheduleTime.trim() || reschedulingItem.workout.scheduled_time || null,
          notes: rescheduleNotes.trim() || null,
        }),
      });
      setReschedulingItem(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleNotes('');
      await loadOverrides(weekStartDate, weekEndDate);
      setInspectingItem(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao reagendar atendimento.');
    } finally {
      setSavingReschedule(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Agenda do Personal
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Atendimentos da Semana
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Controle de atendimentos semanais. Cancele ou reagende qualquer atendimento para aquele dia específico sem afetar a rotina geral.
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

      {/* Navegador da Semana de Atendimentos */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-emerald-500 shadow-xs`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Semana Selecionada
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>
                {weekDays[0].dayFormatted} a {weekDays[6].dayFormatted} de {weekDays[6].date.getFullYear()}
              </span>
              {weekOffset === 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                  Esta Semana
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              weekOffset === 0
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Hoje / Semana Atual
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Próxima semana"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Atendimentos Ativos
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.totalWorkouts}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Nesta semana ({weekDays[0].dayFormatted} a {weekDays[6].dayFormatted})
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Alunos Ativos
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.totalStudents}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Com treinos agendados
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Treinos de Hoje
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.todayWorkoutsCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Programados para {DAYS_OF_WEEK[new Date().getDay()]}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className={`${cardCls} p-4.5 flex items-center justify-between gap-3`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cancelados nesta Semana
            </div>
            <div className={`text-2xl font-bold mt-0.5 ${metrics.cancelledCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {metrics.cancelledCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {metrics.cancelledCount > 0 ? 'Cancelados para esta data' : 'Nenhum cancelamento'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={`${cardCls} p-4 space-y-3`}>
        <div className="flex flex-col md:flex-row gap-3">
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

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <select
              aria-label="Filtrar por grupo"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className={`${inputCls} w-full sm:w-52`}
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
              className={`${inputCls} w-full sm:w-56`}
            >
              <option value="all">Todos os horários</option>
              <option value="morning">Manhã (antes de 12:00)</option>
              <option value="afternoon">Tarde (12:00 às 18:00)</option>
              <option value="night">Noite (a partir de 18:00)</option>
              <option value="no_time">Sem horário marcado</option>
            </select>
          </div>
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
          {weekDays.map((day) => {
            const countForDay = (weekAttendanceByDay.get(day.dayIndex) || []).length;
            const isSelected = selectedDayFilter === day.dayIndex;

            return (
              <button
                key={day.dayIndex}
                type="button"
                onClick={() => setSelectedDayFilter(day.dayIndex)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : day.isToday
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{DAYS_OF_WEEK_SHORT[day.dayIndex]} ({day.dayFormatted})</span>
                {day.isToday && <span className="text-[10px] font-bold">• Hoje</span>}
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
            Para que os atendimentos apareçam aqui, acesse a <strong>Gestão de Alunos</strong>, selecione um aluno com agenda definida como <em>"Dias Fixos da Semana"</em> e clique em <strong>"Agendar Treino"</strong>.
          </p>
        </div>
      )}

      {!loading && workouts.length > 0 && allWeekItems.length === 0 && (
        <div className={`${cardCls} p-12 text-center space-y-2 text-slate-400`}>
          <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            Nenhum atendimento nesta semana com os filtros selecionados
          </div>
          <p className="text-xs">Tente alterar o termo de busca ou limpar os filtros de grupo e turno.</p>
        </div>
      )}

      {/* MODO 1: GRADE SEMANAL (7 DIAS) */}
      {!loading && viewMode === 'grid' && allWeekItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 items-start">
          {weekDays.map((day) => {
            if (selectedDayFilter !== 'all' && selectedDayFilter !== day.dayIndex) {
              return null;
            }

            const dayItems = weekAttendanceByDay.get(day.dayIndex) || [];
            const isWeekend = day.dayIndex === 0 || day.dayIndex === 6;

            return (
              <div
                key={day.dayIndex}
                className={`flex flex-col rounded-2xl border transition min-h-[480px] ${
                  day.isToday
                    ? 'bg-white dark:bg-slate-900 border-emerald-500/80 dark:border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-md'
                    : dayItems.length > 0
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Cabeçalho da Coluna do Dia */}
                <div
                  className={`p-3 border-b rounded-t-2xl flex items-center justify-between gap-1.5 ${
                    day.isToday
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : isWeekend
                      ? 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                      : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                        day.isToday ? 'text-white' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      <span>{day.dayName}</span>
                      <span className={`text-[11px] font-medium ${day.isToday ? 'text-emerald-100' : 'text-slate-500'}`}>
                        ({day.dayFormatted})
                      </span>
                      {day.isToday && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-white text-emerald-700">
                          Hoje
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-medium ${
                        day.isToday ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {dayItems.length === 0
                        ? 'Nenhum atendimento'
                        : `${dayItems.length} atendimento(s)`}
                    </div>
                  </div>
                </div>

                {/* Lista de Atendimentos Agendados no Dia */}
                <div className="p-2.5 flex-1 flex flex-col space-y-2.5">
                  {dayItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                      <span className="text-[11px] italic">Sem atendimentos agendados</span>
                    </div>
                  ) : (
                    dayItems.map((item) => {
                      const isCancelled = item.status === 'cancelled';
                      const isRescheduledAway = item.status === 'rescheduled_away';
                      const isRescheduledHere = item.status === 'rescheduled_here';
                      const isRescheduledCancelled = item.status === 'rescheduled_cancelled';
                      const isCompleted = item.status === 'completed';
                      const isAnyCancelled = isCancelled || isRescheduledCancelled;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setInspectingItem(item)}
                          className={`p-3 rounded-xl border transition group flex flex-col justify-between gap-2.5 cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 shadow-xs'
                              : isAnyCancelled
                              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 opacity-80'
                              : isRescheduledAway
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 opacity-80'
                              : isRescheduledHere
                              ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 hover:border-purple-400 shadow-xs'
                              : 'bg-slate-50/90 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xs'
                          }`}
                        >
                          <div className="space-y-1.5">
                            {/* Badges de Status e Horário */}
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  Concluído
                                </span>
                              ) : isRescheduledCancelled ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/90 dark:text-rose-300">
                                  <Ban className="w-2.5 h-2.5" />
                                  Cancelado (Reagendado)
                                </span>
                              ) : isCancelled ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/90 dark:text-rose-300">
                                  <Ban className="w-2.5 h-2.5" />
                                  Cancelado no dia
                                </span>
                              ) : isRescheduledAway ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300">
                                  <ArrowRightLeft className="w-2.5 h-2.5" />
                                  Reagendado
                                </span>
                              ) : isRescheduledHere ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/90 dark:text-purple-300">
                                  <Clock className="w-2.5 h-2.5" />
                                  {item.scheduledTime || 'Horário livre'} • Reagendado
                                </span>
                              ) : item.scheduledTime ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                                  <Clock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  {item.scheduledTime}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                  <Clock className="w-2.5 h-2.5" />
                                  Horário livre
                                </span>
                              )}

                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  (item.workout.student_group_name || '').toLowerCase() === 'online'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                {item.workout.student_group_name || 'Presencial'}
                              </span>
                            </div>

                            {/* Informações do Aluno e Treino */}
                            <div>
                              <div className={`font-bold text-xs truncate flex items-center gap-1 ${
                                isAnyCancelled ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                              }`}>
                                <User className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate">{item.workout.student_name}</span>
                              </div>
                              <div className={`text-[11px] font-semibold truncate mt-0.5 flex items-center gap-1 ${
                                isAnyCancelled ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                <Dumbbell className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span className="truncate">{item.workout.name}</span>
                              </div>
                            </div>

                            {/* Detalhe de Reagendamento se houver */}
                            {isRescheduledAway && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 p-1.5 rounded-lg">
                                Transferido para: <strong>{formatDatePtBr(item.targetDate)}</strong>
                                {item.targetTime ? ` às ${item.targetTime}` : ''}
                                {item.overrideNotes && <div className="italic mt-0.5">"{item.overrideNotes}"</div>}
                              </div>
                            )}

                            {isRescheduledHere && item.originalDate && (
                              <div className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-950/40 p-1.5 rounded-lg">
                                Originalmente de: <strong>{formatDatePtBr(item.originalDate)}</strong>
                                {item.overrideNotes && <div className="italic mt-0.5">"{item.overrideNotes}"</div>}
                              </div>
                            )}

                            {isRescheduledCancelled && (
                              <div className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-950/40 p-1.5 rounded-lg">
                                {item.originalDate && <div>Originalmente de: <strong>{formatDatePtBr(item.originalDate)}</strong></div>}
                                {item.overrideNotes && <div className="italic mt-0.5">Motivo: "{item.overrideNotes}"</div>}
                              </div>
                            )}

                            {isCancelled && item.overrideNotes && (
                              <div className="text-[10px] text-rose-700 dark:text-rose-300 italic">
                                Motivo: "{item.overrideNotes}"
                              </div>
                            )}

                            {/* Exercícios resumo */}
                            {!isAnyCancelled && !isRescheduledAway && item.workout.items.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 space-y-0.5">
                                {item.workout.items.slice(0, 3).map((it, i) => (
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
                                {item.workout.items.length > 3 && (
                                  <div className="text-[9px] text-slate-400 italic">
                                    +{item.workout.items.length - 3} mais exercícios...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* BOTÃO DE INICIAR ATENDIMENTO / STATUS CONCLUÍDO */}
                          {(item.status === 'scheduled' || item.status === 'rescheduled_here') && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRunningSessionItem(item);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Iniciar Atendimento
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <div className="pt-1">
                              <div className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  Atendido
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRunningSessionItem(item);
                                  }}
                                  className="text-[10px] text-emerald-700 dark:text-emerald-300 hover:underline font-semibold cursor-pointer"
                                >
                                  Refazer
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Botões de Ação Direta no Card */}
                          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between gap-1.5 text-[10px] flex-wrap">
                            {isRescheduledHere ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRescheduleModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                                  title="Reagendar este treino"
                                >
                                  <CalendarClock className="w-3 h-3" /> Reagendar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCancelModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                                  title="Cancelar atendimento reagendado"
                                >
                                  <Ban className="w-3 h-3" /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestore(item.workout.id, item.originalDate || item.dateStr);
                                  }}
                                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                  title="Restaurar atendimento para a programação original"
                                >
                                  <RotateCcw className="w-3 h-3" /> Restaurar
                                </button>
                              </div>
                            ) : isRescheduledCancelled ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRescheduleModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                                  title="Reagendar este treino"
                                >
                                  <CalendarClock className="w-3 h-3" /> Reagendar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestore(item.workout.id, item.originalDate || item.dateStr);
                                  }}
                                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                  title="Restaurar atendimento para a programação original"
                                >
                                  <RotateCcw className="w-3 h-3" /> Restaurar
                                </button>
                              </div>
                            ) : isCancelled || isRescheduledAway ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(item.workout.id, item.originalDate || item.dateStr);
                                }}
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                title="Restaurar atendimento para a programação original"
                              >
                                <RotateCcw className="w-3 h-3" /> Restaurar
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRescheduleModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                                  title="Reagendar este treino nesta semana"
                                >
                                  <CalendarClock className="w-3 h-3" /> Reagendar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCancelModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                                  title="Cancelar atendimento apenas deste dia"
                                >
                                  <Ban className="w-3 h-3" /> Cancelar
                                </button>
                              </div>
                            )}

                            <span className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium ml-auto">
                              Ver →
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODO 2: LISTA / TIMELINE CRONOLÓGICA */}
      {!loading && viewMode === 'timeline' && allWeekItems.length > 0 && (
        <div className="space-y-4">
          {weekDays.map((day) => {
            if (selectedDayFilter !== 'all' && selectedDayFilter !== day.dayIndex) {
              return null;
            }

            const dayItems = weekAttendanceByDay.get(day.dayIndex) || [];
            if (dayItems.length === 0) return null;

            return (
              <div key={day.dayIndex} className={`${cardCls} p-5 space-y-4`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {day.dayName} ({day.dayFormatted})
                    </h3>
                    {day.isToday && (
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                        Hoje
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {dayItems.length} atendimento(s)
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayItems.map((item) => {
                    const isCancelled = item.status === 'cancelled';
                    const isRescheduledAway = item.status === 'rescheduled_away';
                    const isRescheduledHere = item.status === 'rescheduled_here';
                    const isRescheduledCancelled = item.status === 'rescheduled_cancelled';
                    const isCompleted = item.status === 'completed';
                    const isAnyCancelled = isCancelled || isRescheduledCancelled;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setInspectingItem(item)}
                        className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-2.5 transition cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800'
                            : isAnyCancelled
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 opacity-80'
                            : isRescheduledAway
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 opacity-80'
                            : isRescheduledHere
                            ? 'bg-purple-50/40 dark:bg-purple-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-24 shrink-0">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Atendido
                              </span>
                            ) : isRescheduledCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                <Ban className="w-3 h-3" /> Cancelado
                              </span>
                            ) : isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                <Ban className="w-3 h-3" /> Cancelado
                              </span>
                            ) : isRescheduledAway ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <ArrowRightLeft className="w-3 h-3" /> Movido
                              </span>
                            ) : isRescheduledHere ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                {item.scheduledTime || 'Horário livre'}
                              </span>
                            ) : item.scheduledTime ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                                <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                {item.scheduledTime}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Sem horário
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`font-bold text-sm ${isAnyCancelled ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {item.workout.student_name}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  (item.workout.student_group_name || '').toLowerCase() === 'online'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                {item.workout.student_group_name || 'Presencial'}
                              </span>
                              {item.workout.student_phone && (
                                <span className="text-xs text-slate-400">
                                  {item.workout.student_phone}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <Dumbbell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="font-semibold">{item.workout.name}</span>
                              <span>• {item.workout.items.length} exercício(s)</span>
                              {isRescheduledAway && (
                                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                  — Transferido para {formatDatePtBr(item.targetDate)} {item.targetTime ? `às ${item.targetTime}` : ''}
                                </span>
                              )}
                              {isRescheduledHere && (
                                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                  — Reagendado da data {formatDatePtBr(item.originalDate)}
                                </span>
                              )}
                              {isRescheduledCancelled && (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  — Reagendado de {formatDatePtBr(item.originalDate)} e Cancelado {item.overrideNotes ? `(${item.overrideNotes})` : ''}
                                </span>
                              )}
                              {isCancelled && item.overrideNotes && (
                                <span className="text-rose-600 dark:text-rose-400 italic">
                                  — Motivo: {item.overrideNotes}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                          {/* Botão de Iniciar Atendimento na Timeline */}
                          {(item.status === 'scheduled' || item.status === 'rescheduled_here') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRunningSessionItem(item);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" /> Iniciar Atendimento
                            </button>
                          )}

                          {isCompleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRunningSessionItem(item);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-800 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Refazer Atendimento
                            </button>
                          )}

                          {isRescheduledHere ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRescheduleModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
                                title="Reagendar este treino"
                              >
                                <CalendarClock className="w-3.5 h-3.5" /> Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancelModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 cursor-pointer"
                                title="Cancelar atendimento reagendado"
                              >
                                <Ban className="w-3.5 h-3.5" /> Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(item.workout.id, item.originalDate || item.dateStr);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-1 cursor-pointer"
                                title="Restaurar atendimento para a programação original"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                              </button>
                            </>
                          ) : isRescheduledCancelled ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRescheduleModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
                                title="Reagendar este treino"
                              >
                                <CalendarClock className="w-3.5 h-3.5" /> Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(item.workout.id, item.originalDate || item.dateStr);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-1 cursor-pointer"
                                title="Restaurar atendimento para a programação original"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                              </button>
                            </>
                          ) : isCancelled || isRescheduledAway ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(item.workout.id, item.originalDate || item.dateStr);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRescheduleModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
                              >
                                <CalendarClock className="w-3.5 h-3.5" /> Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancelModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingItem(item);
                            }}
                            className={btnGhost}
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE DETALHES DO ATENDIMENTO */}
      {inspectingItem && (
        <Modal
          title={`Atendimento de ${formatDatePtBr(inspectingItem.dateStr)} — ${inspectingItem.workout.student_name}`}
          onClose={() => setInspectingItem(null)}
        >
          <div className="space-y-5">
            {/* Aviso de Status do Atendimento */}
            {inspectingItem.status === 'cancelled' && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">Este atendimento está cancelado para esta data ({formatDatePtBr(inspectingItem.dateStr)}).</span>
                    {inspectingItem.overrideNotes && (
                      <p className="mt-0.5 italic">Motivo: "{inspectingItem.overrideNotes}"</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(inspectingItem.workout.id, inspectingItem.originalDate || inspectingItem.dateStr)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" /> Restaurar Atendimento
                </button>
              </div>
            )}

            {inspectingItem.status === 'rescheduled_away' && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Este atendimento foi reagendado para {formatDatePtBr(inspectingItem.targetDate)} {inspectingItem.targetTime ? `às ${inspectingItem.targetTime}` : ''}.</span>
                    {inspectingItem.overrideNotes && (
                      <p className="mt-0.5 italic">Motivo: "{inspectingItem.overrideNotes}"</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(inspectingItem.workout.id, inspectingItem.originalDate || inspectingItem.dateStr)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" /> Restaurar para este Dia
                </button>
              </div>
            )}

            {inspectingItem.status === 'rescheduled_here' && (
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 flex items-center justify-between gap-3 text-xs text-purple-800 dark:text-purple-300">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <span className="font-bold">Atendimento reagendado para hoje (Originalmente de {formatDatePtBr(inspectingItem.originalDate)}).</span>
                    {inspectingItem.overrideNotes && (
                      <p className="mt-0.5 italic">Motivo: "{inspectingItem.overrideNotes}"</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(inspectingItem.workout.id, inspectingItem.originalDate || inspectingItem.dateStr)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" /> Voltar à Data Original
                </button>
              </div>
            )}

            {inspectingItem.status === 'rescheduled_cancelled' && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">Este atendimento reagendado está cancelado para esta data ({formatDatePtBr(inspectingItem.dateStr)}).</span>
                    {inspectingItem.originalDate && (
                      <p className="mt-0.5 text-[11px]">Originalmente de: {formatDatePtBr(inspectingItem.originalDate)}</p>
                    )}
                    {inspectingItem.overrideNotes && (
                      <p className="mt-0.5 italic">Motivo: "{inspectingItem.overrideNotes}"</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(inspectingItem.workout.id, inspectingItem.originalDate || inspectingItem.dateStr)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" /> Restaurar Atendimento
                </button>
              </div>
            )}

            {/* Informações Principais do Aluno e Horário */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">Aluno</div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {inspectingItem.workout.student_name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                    Grupo: {inspectingItem.workout.student_group_name || 'Presencial'}
                  </span>
                  {inspectingItem.workout.student_gender && (
                    <span className="text-slate-500 text-[11px]">
                      {inspectingItem.workout.student_gender}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">
                  Data & Horário Deste Atendimento
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {DAYS_OF_WEEK[inspectingItem.dayIndex]} ({formatDatePtBr(inspectingItem.dateStr)})
                </div>
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium text-xs mt-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {inspectingItem.scheduledTime
                    ? `Horário: ${inspectingItem.scheduledTime}`
                    : 'Sem horário fixo estipulado'}
                </div>
              </div>

              {/* Contatos */}
              {inspectingItem.workout.student_phone && (
                <div className="sm:col-span-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {inspectingItem.workout.student_phone}
                    </span>
                  </div>
                  {sanitizePhoneForWhatsApp(inspectingItem.workout.student_phone) && (
                    <a
                      href={`https://wa.me/${sanitizePhoneForWhatsApp(inspectingItem.workout.student_phone)}`}
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
                    {inspectingItem.workout.name}
                  </h3>
                  {inspectingItem.workout.notes && (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      {inspectingItem.workout.notes}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {inspectingItem.workout.items.length} exercício(s)
                </span>
              </div>

              {/* Lista de Exercícios */}
              {inspectingItem.workout.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Nenhum exercício cadastrado para este treino.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {inspectingItem.workout.items.map((item, idx) => {
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

            {inspectingItem.status === 'completed' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Atendimento realizado com sucesso nesta data ({formatDatePtBr(inspectingItem.dateStr)}).</span>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Os registros de execução e intercorrências estão gravados na ficha do aluno.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRunningSessionItem(inspectingItem);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" /> Refazer Atendimento
                </button>
              </div>
            )}

            {/* BOTÃO PRINCIPAL DE INICIAR ATENDIMENTO (QUANDO PENDENTE) */}
            {(inspectingItem.status === 'scheduled' || inspectingItem.status === 'rescheduled_here') && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRunningSessionItem(inspectingItem);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar Atendimento Agora
                </button>
              </div>
            )}

            {(inspectingItem.status === 'scheduled' || inspectingItem.status === 'rescheduled_here') && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold">Gerenciar atendimento deste dia:</span>
                  <p className="text-[11px] text-slate-400">
                    Qualquer alteração afetará apenas o atendimento desta semana ({formatDatePtBr(inspectingItem.dateStr)}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRescheduleModal(inspectingItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Reagendar
                  </button>
                  <button
                    type="button"
                    onClick={() => openCancelModal(inspectingItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {inspectingItem.status === 'rescheduled_cancelled' && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold">Gerenciar atendimento cancelado:</span>
                  <p className="text-[11px] text-slate-400">
                    Você pode reagendar este treino para uma nova data ou restaurá-lo para a rotina semanal original.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRescheduleModal(inspectingItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Reagendar para Outra Data
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestore(inspectingItem.workout.id, inspectingItem.originalDate || inspectingItem.dateStr)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão
                  </button>
                </div>
              </div>
            )}

            {/* Rodapé com botões de navegação */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className={btnGhost}
              >
                Fechar
              </button>

              {onNavigateToStudent && (
                <button
                  type="button"
                  onClick={() => {
                    const studentId = inspectingItem.workout.student_id;
                    setInspectingItem(null);
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

      {/* MODAL PARA CANCELAR ATENDIMENTO */}
      {cancellingItem && (
        <Modal
          title={`Cancelar Atendimento — ${cancellingItem.workout.student_name}`}
          onClose={() => setCancellingItem(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <p className="font-bold">
                  Você está cancelando este atendimento exclusivamente para o dia {formatDatePtBr(cancellingItem.dateStr)}.
                </p>
                <p className="text-[11px] opacity-90">
                  Treino: <strong>{cancellingItem.workout.name}</strong> • Horário: <strong>{cancellingItem.scheduledTime || 'Sem horário'}</strong>
                </p>
                <p className="text-[11px] opacity-80">
                  A rotina semanal do aluno nas outras semanas continuará normalmente. Você pode restaurar este atendimento a qualquer momento.
                </p>
              </div>
            </div>

            <Field label="Motivo do cancelamento (opcional)">
              <textarea
                rows={3}
                placeholder="Ex: Aluno viajou a trabalho, avisou com antecedência..."
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingCancel}
                onClick={() => setCancellingItem(null)}
                className={btnGhost}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={savingCancel}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                {savingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PARA REAGENDAR ATENDIMENTO */}
      {reschedulingItem && (
        <Modal
          title={`Reagendar Atendimento — ${reschedulingItem.workout.student_name}`}
          onClose={() => setReschedulingItem(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1">
                <p className="font-bold">
                  Reagendando atendimento de {formatDatePtBr(reschedulingItem.originalDate || reschedulingItem.dateStr)}.
                </p>
                <p className="text-[11px] opacity-90">
                  Treino: <strong>{reschedulingItem.workout.name}</strong>
                </p>
                <p className="text-[11px] opacity-80">
                  Esta alteração de data e horário afetará exclusivamente este atendimento. As outras semanas continuam no dia fixo padrão.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nova Data do Atendimento *">
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Novo Horário (HH:mm)">
                <input
                  type="time"
                  placeholder="08:00"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Motivo do reagendamento (opcional)">
              <textarea
                rows={2}
                placeholder="Ex: Aluno pediu para antecipar por compromisso médico..."
                value={rescheduleNotes}
                onChange={(e) => setRescheduleNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingReschedule}
                onClick={() => setReschedulingItem(null)}
                className={btnGhost}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={savingReschedule}
                onClick={handleConfirmReschedule}
                className={btnPrimary}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {savingReschedule ? 'Reagendando...' : 'Confirmar Reagendamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* JORNADA STEP-BY-STEP DE ATENDIMENTO DO PERSONAL */}
      {runningSessionItem && (
        <AttendanceSessionRunner
          workout={runningSessionItem.workout}
          studentId={runningSessionItem.workout.student_id}
          studentName={runningSessionItem.workout.student_name}
          studentPhone={runningSessionItem.workout.student_phone}
          studentGroup={runningSessionItem.workout.student_group_name}
          sessionDate={runningSessionItem.dateStr}
          scheduledWorkoutId={runningSessionItem.workout.id}
          onClose={() => setRunningSessionItem(null)}
          onSessionCompleted={async () => {
            setRunningSessionItem(null);
            await loadOverrides(weekStartDate, weekEndDate);
            if (inspectingItem) setInspectingItem(null);
          }}
        />
      )}
    </div>
  );
};
