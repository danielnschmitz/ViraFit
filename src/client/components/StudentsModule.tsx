import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  Ban,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Dumbbell,
  FileText,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DAYS_OF_WEEK_SHORT,
  Organization,
  SCHEME_TYPES_INFO,
  ScheduleType,
  ScheduledWorkoutOverride,
  Student,
  StudentGroup,
  StudentScheduledWorkout,
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
  initialStudentId?: string | null;
}

const emptyStudent = {
  name: '',
  document: '',
  phone: '',
  gender: 'Masculino' as Student['gender'],
  group_id: '',
  group_name: 'Presencial',
  schedule_type: 'fixed_days' as ScheduleType,
  notes: '',
  email: '',
  zip_code: '',
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  delivery_instructions: '',
};

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

export const StudentsModule: React.FC<StudentsModuleProps> = ({ org, initialStudentId }) => {
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

  // Ficha do Aluno Selecionado
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [studentTab, setStudentTab] = useState<'agenda' | 'free_workouts'>('agenda');
  const [studentWorkouts, setStudentWorkouts] = useState<StudentWorkout[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<StudentScheduledWorkout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingStudentData, setLoadingStudentData] = useState(false);

  // Criação / Edição de Treino Livre do Aluno
  const [editingWorkout, setEditingWorkout] = useState<StudentWorkout | 'new' | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [workoutItems, setWorkoutItems] = useState<WorkoutExerciseItem[]>([]);
  const [selectedTemplateToImport, setSelectedTemplateToImport] = useState('');
  const [savingWorkout, setSavingWorkout] = useState(false);

  // Criação / Edição de Treino Agendado do Aluno
  const [editingScheduled, setEditingScheduled] = useState<StudentScheduledWorkout | 'new' | null>(
    null
  );
  const [scheduledName, setScheduledName] = useState('');
  const [scheduledNotes, setScheduledNotes] = useState('');
  const [scheduledDaysOfWeek, setScheduledDaysOfWeek] = useState<number[]>([1]); // Segunda por padrão
  const [scheduledTime, setScheduledTime] = useState(''); // HH:mm (horário de execução)
  const [scheduledSequenceOrder, setScheduledSequenceOrder] = useState<number>(1);
  const [scheduledStartDate, setScheduledStartDate] = useState('');
  const [scheduledEndDate, setScheduledEndDate] = useState('');
  const [scheduledItems, setScheduledItems] = useState<WorkoutExerciseItem[]>([]);
  const [scheduledSourceType, setScheduledSourceType] = useState<
    'new' | 'template' | 'student_workout'
  >('new');
  const [selectedTemplateForScheduled, setSelectedTemplateForScheduled] = useState('');
  const [selectedStudentWorkoutForScheduled, setSelectedStudentWorkoutForScheduled] = useState('');
  const [savingScheduled, setSavingScheduled] = useState(false);

  // Controle de Semana e Overrides na Agenda do Aluno
  const [studentWeekOffset, setStudentWeekOffset] = useState<number>(0);
  const [studentOverrides, setStudentOverrides] = useState<ScheduledWorkoutOverride[]>([]);

  // Estados de cancelamento / reagendamento na ficha do aluno
  const [studentCancellingItem, setStudentCancellingItem] = useState<{
    workout: StudentScheduledWorkout;
    dateStr: string;
    scheduledTime?: string | null;
  } | null>(null);
  const [studentCancelNotes, setStudentCancelNotes] = useState('');
  const [studentSavingCancel, setStudentSavingCancel] = useState(false);

  const [studentReschedulingItem, setStudentReschedulingItem] = useState<{
    workout: StudentScheduledWorkout;
    dateStr: string;
    scheduledTime?: string | null;
  } | null>(null);
  const [studentRescheduleDate, setStudentRescheduleDate] = useState('');
  const [studentRescheduleTime, setStudentRescheduleTime] = useState('');
  const [studentRescheduleNotes, setStudentRescheduleNotes] = useState('');
  const [studentSavingReschedule, setStudentSavingReschedule] = useState(false);

  const studentWeekDays = useMemo(() => {
    const now = new Date();
    const sunday = getSundayOfWeek(now);
    sunday.setDate(sunday.getDate() + studentWeekOffset * 7);

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
  }, [studentWeekOffset]);

  const loadStudentOverrides = async (start: string, end: string, sId: string) => {
    try {
      const data = await apiFetch<ScheduledWorkoutOverride[]>(
        `/api/org/scheduled-workout-overrides?startDate=${start}&endDate=${end}&studentId=${sId}`
      );
      setStudentOverrides(data);
    } catch (err: any) {
      console.error('[StudentOverrides] Erro ao carregar exceções:', err);
    }
  };

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

  const loadStudentDetails = async (studentId: string) => {
    setLoadingStudentData(true);
    try {
      const [wkRes, scheduledRes, tplRes] = await Promise.all([
        apiFetch<StudentWorkout[]>(`/api/org/students/${studentId}/workouts`),
        apiFetch<StudentScheduledWorkout[]>(`/api/org/students/${studentId}/scheduled-workouts`),
        apiFetch<WorkoutTemplate[]>('/api/org/workout-templates'),
      ]);
      setStudentWorkouts(wkRes);
      setScheduledWorkouts(scheduledRes);
      setTemplates(tplRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingStudentData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetails(selectedStudentId);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (selectedStudentId && studentWeekDays.length === 7) {
      loadStudentOverrides(studentWeekDays[0].dateStr, studentWeekDays[6].dateStr, selectedStudentId);
    }
  }, [selectedStudentId, studentWeekDays]);

  const handleStudentRestore = async (scheduledWorkoutId: string, originalDate: string) => {
    if (!window.confirm('Deseja restaurar este atendimento para o padrão semanal original?')) return;
    try {
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'DELETE',
        body: JSON.stringify({
          scheduled_workout_id: scheduledWorkoutId,
          original_date: originalDate,
        }),
      });
      if (selectedStudentId) {
        await loadStudentOverrides(studentWeekDays[0].dateStr, studentWeekDays[6].dateStr, selectedStudentId);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao restaurar agendamento.');
    }
  };

  const handleStudentConfirmCancel = async () => {
    if (!studentCancellingItem || !selectedStudentId) return;
    setStudentSavingCancel(true);
    try {
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'POST',
        body: JSON.stringify({
          scheduled_workout_id: studentCancellingItem.workout.id,
          student_id: selectedStudentId,
          original_date: studentCancellingItem.dateStr,
          status: 'cancelled',
          notes: studentCancelNotes.trim() || null,
        }),
      });
      setStudentCancellingItem(null);
      setStudentCancelNotes('');
      await loadStudentOverrides(studentWeekDays[0].dateStr, studentWeekDays[6].dateStr, selectedStudentId);
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar atendimento.');
    } finally {
      setStudentSavingCancel(false);
    }
  };

  const handleStudentConfirmReschedule = async () => {
    if (!studentReschedulingItem || !selectedStudentId) return;
    if (!studentRescheduleDate) {
      alert('Informe a nova data para o atendimento.');
      return;
    }
    setStudentSavingReschedule(true);
    try {
      await apiFetch('/api/org/scheduled-workout-overrides', {
        method: 'POST',
        body: JSON.stringify({
          scheduled_workout_id: studentReschedulingItem.workout.id,
          student_id: selectedStudentId,
          original_date: studentReschedulingItem.dateStr,
          status: 'rescheduled',
          rescheduled_date: studentRescheduleDate,
          rescheduled_time: studentRescheduleTime.trim() || studentReschedulingItem.workout.scheduled_time || null,
          notes: studentRescheduleNotes.trim() || null,
        }),
      });
      setStudentReschedulingItem(null);
      setStudentRescheduleDate('');
      setStudentRescheduleTime('');
      setStudentRescheduleNotes('');
      await loadStudentOverrides(studentWeekDays[0].dateStr, studentWeekDays[6].dateStr, selectedStudentId);
    } catch (err: any) {
      alert(err.message || 'Erro ao reagendar atendimento.');
    } finally {
      setStudentSavingReschedule(false);
    }
  };

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
        schedule_type: 'fixed_days',
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
        schedule_type: s.schedule_type || 'fixed_days',
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

  /* -------------------- Treinos Livres do Aluno -------------------- */
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
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
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
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStudentWorkout = async (wk: StudentWorkout) => {
    if (!selectedStudent) return;
    if (!window.confirm(`Deseja realmente excluir o treino livre "${wk.name}" deste aluno?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/students/${selectedStudent.id}/workouts/${wk.id}`, {
        method: 'DELETE',
      });
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* -------------------- Treinos Agendados do Aluno -------------------- */
  const startNewScheduledWorkout = (preselectedDay?: number) => {
    setError(null);
    setEditingScheduled('new');
    setScheduledName('');
    setScheduledNotes('');
    setScheduledTime('');
    setScheduledStartDate('');
    setScheduledEndDate('');
    setScheduledItems([]);
    setScheduledSourceType('new');
    setSelectedTemplateForScheduled('');
    setSelectedStudentWorkoutForScheduled('');

    if (selectedStudent?.schedule_type === 'sequence') {
      const nextSeq =
        scheduledWorkouts.length > 0
          ? Math.max(...scheduledWorkouts.map((w) => w.sequence_order || 1)) + 1
          : 1;
      setScheduledSequenceOrder(nextSeq);
      setScheduledDaysOfWeek([]);
    } else {
      setScheduledDaysOfWeek(preselectedDay !== undefined ? [preselectedDay] : [1]);
    }
  };

  const startEditScheduledWorkout = (swk: StudentScheduledWorkout) => {
    setError(null);
    setEditingScheduled(swk);
    setScheduledName(swk.name);
    setScheduledNotes(swk.notes || '');
    setScheduledTime(swk.scheduled_time || '');
    setScheduledStartDate(swk.start_date || '');
    setScheduledEndDate(swk.end_date || '');
    setScheduledItems(swk.items.map((i) => ({ ...i })));
    setScheduledSourceType('new');
    setSelectedTemplateForScheduled('');
    setSelectedStudentWorkoutForScheduled('');

    if (swk.schedule_type === 'sequence') {
      setScheduledSequenceOrder(swk.sequence_order || 1);
      setScheduledDaysOfWeek([]);
    } else {
      setScheduledDaysOfWeek(
        swk.day_of_week !== undefined && swk.day_of_week !== null ? [swk.day_of_week] : [1]
      );
    }
  };

  const handleScheduledSourceChange = (
    type: 'new' | 'template' | 'student_workout',
    sourceId?: string
  ) => {
    setScheduledSourceType(type);
    if (type === 'new') {
      return;
    }
    if (type === 'template' && sourceId) {
      setSelectedTemplateForScheduled(sourceId);
      const tpl = templates.find((t) => t.id === sourceId);
      if (tpl) {
        if (!scheduledName.trim() || scheduledSourceType !== 'template') {
          setScheduledName(tpl.name);
        }
        setScheduledItems(tpl.items.map((i) => ({ ...i })));
      }
    } else if (type === 'student_workout' && sourceId) {
      setSelectedStudentWorkoutForScheduled(sourceId);
      const wk = studentWorkouts.find((w) => w.id === sourceId);
      if (wk) {
        if (!scheduledName.trim() || scheduledSourceType !== 'student_workout') {
          setScheduledName(wk.name);
        }
        setScheduledNotes(wk.notes || '');
        setScheduledItems(wk.items.map((i) => ({ ...i })));
      }
    }
  };

  const handleToggleScheduledDay = (dayIndex: number) => {
    setScheduledDaysOfWeek((prev) => {
      if (prev.includes(dayIndex)) {
        if (editingScheduled && editingScheduled !== 'new' && prev.length === 1) {
          return prev;
        }
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIndex);
      } else {
        if (editingScheduled && editingScheduled !== 'new') {
          return [dayIndex];
        }
        return [...prev, dayIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSaveScheduledWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError(null);

    if (!scheduledName.trim()) {
      setError('O Nome do treino agendado é obrigatório.');
      return;
    }

    const currentScheduleType = selectedStudent.schedule_type || 'fixed_days';

    if (currentScheduleType === 'fixed_days' && scheduledDaysOfWeek.length === 0) {
      setError('Selecione pelo menos um dia da semana para o treino.');
      return;
    }

    setSavingScheduled(true);
    try {
      const payload: any = {
        name: scheduledName.trim(),
        notes: scheduledNotes.trim() || null,
        schedule_type: currentScheduleType,
        start_date: scheduledStartDate.trim() || null,
        end_date: scheduledEndDate.trim() || null,
        scheduled_time:
          currentScheduleType === 'fixed_days' && scheduledTime.trim()
            ? scheduledTime.trim()
            : null,
        items: scheduledItems,
      };

      if (currentScheduleType === 'fixed_days') {
        if (editingScheduled && editingScheduled !== 'new') {
          payload.day_of_week = scheduledDaysOfWeek[0];
        } else {
          payload.days_of_week = scheduledDaysOfWeek;
        }
      } else {
        payload.sequence_order = scheduledSequenceOrder || 1;
      }

      if (editingScheduled && editingScheduled !== 'new') {
        await apiFetch(
          `/api/org/students/${selectedStudent.id}/scheduled-workouts/${editingScheduled.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiFetch(`/api/org/students/${selectedStudent.id}/scheduled-workouts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setEditingScheduled(null);
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingScheduled(false);
    }
  };

  const handleDeleteScheduledWorkout = async (swk: StudentScheduledWorkout) => {
    if (!selectedStudent) return;
    if (!window.confirm(`Deseja realmente excluir o treino agendado "${swk.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/org/students/${selectedStudent.id}/scheduled-workouts/${swk.id}`, {
        method: 'DELETE',
      });
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDuplicateScheduledWorkout = async (swk: StudentScheduledWorkout) => {
    if (!selectedStudent) return;
    setError(null);
    try {
      const payload: any = {
        name: `${swk.name} (Cópia)`,
        notes: swk.notes || null,
        schedule_type: swk.schedule_type,
        start_date: swk.start_date || null,
        end_date: swk.end_date || null,
        scheduled_time: swk.scheduled_time || null,
        items: swk.items,
      };

      if (swk.schedule_type === 'sequence') {
        const nextSeq =
          scheduledWorkouts.length > 0
            ? Math.max(...scheduledWorkouts.map((w) => w.sequence_order || 1)) + 1
            : 1;
        payload.sequence_order = nextSeq;
      } else {
        payload.day_of_week = swk.day_of_week;
      }

      await apiFetch(`/api/org/students/${selectedStudent.id}/scheduled-workouts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await Promise.all([loadStudentDetails(selectedStudent.id), loadData()]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveSequenceOrder = async (
    swk: StudentScheduledWorkout,
    direction: 'up' | 'down'
  ) => {
    if (!selectedStudent) return;
    const sorted = [...scheduledWorkouts].sort(
      (a, b) => (a.sequence_order || 1) - (b.sequence_order || 1)
    );
    const currentIndex = sorted.findIndex((w) => w.id === swk.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetItem = sorted[targetIndex];
    const currentOrder = swk.sequence_order || currentIndex + 1;
    const targetOrder = targetItem.sequence_order || targetIndex + 1;

    try {
      await Promise.all([
        apiFetch(`/api/org/students/${selectedStudent.id}/scheduled-workouts/${swk.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: swk.name,
            notes: swk.notes,
            schedule_type: 'sequence',
            sequence_order: targetOrder,
            start_date: swk.start_date,
            end_date: swk.end_date,
            items: swk.items,
          }),
        }),
        apiFetch(`/api/org/students/${selectedStudent.id}/scheduled-workouts/${targetItem.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: targetItem.name,
            notes: targetItem.notes,
            schedule_type: 'sequence',
            sequence_order: currentOrder,
            start_date: targetItem.start_date,
            end_date: targetItem.end_date,
            items: targetItem.items,
          }),
        }),
      ]);
      await loadStudentDetails(selectedStudent.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleScheduleFreeWorkout = (wk: StudentWorkout) => {
    startNewScheduledWorkout();
    setScheduledName(wk.name);
    setScheduledNotes(wk.notes || '');
    setScheduledItems(wk.items.map((i) => ({ ...i })));
    setScheduledSourceType('student_workout');
    setSelectedStudentWorkoutForScheduled(wk.id);
    setStudentTab('agenda');
  };

  const set = (k: keyof typeof form, v: any) => setForm({ ...form, [k]: v });

  /* =========================================================================
     MODAL DE EDIÇÃO DE DADOS DO ALUNO E GRUPO
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

            {/* SELEÇÃO DO FORMATO DE AGENDA DE TREINOS DO ALUNO */}
            <div className="sm:col-span-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Formato de Agenda de Treinos *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    form.schedule_type === 'fixed_days'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule_type"
                    value="fixed_days"
                    checked={form.schedule_type === 'fixed_days'}
                    onChange={() => set('schedule_type', 'fixed_days')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Dias Fixos da Semana
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      O personal define os dias exatos em que cada treino deve acontecer na semana do aluno (ex: Segundas, Quartas e Sextas).
                    </p>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    form.schedule_type === 'sequence'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule_type"
                    value="sequence"
                    checked={form.schedule_type === 'sequence'}
                    onChange={() => set('schedule_type', 'sequence')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Sequência Cíclica
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      O aluno treina de forma cíclica e progressiva (Treino 1 ➔ Treino 2 ➔ Treino 3...), independentemente do dia da semana.
                    </p>
                  </div>
                </label>
              </div>
            </div>

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

      {/* Modal de Cancelamento de Atendimento da Semana do Aluno */}
      {studentCancellingItem && (
        <Modal
          title={`Cancelar Atendimento — ${studentCancellingItem.workout.name}`}
          onClose={() => setStudentCancellingItem(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <p className="font-bold">
                  Você está cancelando este atendimento exclusivamente para o dia {formatDatePtBr(studentCancellingItem.dateStr)}.
                </p>
                <p className="text-[11px] opacity-90">
                  Treino: <strong>{studentCancellingItem.workout.name}</strong> • Horário: <strong>{studentCancellingItem.scheduledTime || 'Sem horário'}</strong>
                </p>
                <p className="text-[11px] opacity-80">
                  A rotina semanal nas outras semanas continuará normalmente. Você pode restaurar este atendimento a qualquer momento.
                </p>
              </div>
            </div>

            <Field label="Motivo do cancelamento (opcional)">
              <textarea
                rows={3}
                placeholder="Ex: Aluno viajou a trabalho, avisou com antecedência..."
                value={studentCancelNotes}
                onChange={(e) => setStudentCancelNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={studentSavingCancel}
                onClick={() => setStudentCancellingItem(null)}
                className={btnGhost}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={studentSavingCancel}
                onClick={handleStudentConfirmCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                {studentSavingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Reagendamento de Atendimento da Semana do Aluno */}
      {studentReschedulingItem && (
        <Modal
          title={`Reagendar Atendimento — ${studentReschedulingItem.workout.name}`}
          onClose={() => setStudentReschedulingItem(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1">
                <p className="font-bold">
                  Reagendando atendimento de {formatDatePtBr(studentReschedulingItem.dateStr)}.
                </p>
                <p className="text-[11px] opacity-90">
                  Treino: <strong>{studentReschedulingItem.workout.name}</strong>
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
                  value={studentRescheduleDate}
                  onChange={(e) => setStudentRescheduleDate(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Novo Horário (HH:mm)">
                <input
                  type="time"
                  placeholder="08:00"
                  value={studentRescheduleTime}
                  onChange={(e) => setStudentRescheduleTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Motivo do reagendamento (opcional)">
              <textarea
                rows={2}
                placeholder="Ex: Aluno pediu para antecipar por compromisso médico..."
                value={studentRescheduleNotes}
                onChange={(e) => setStudentRescheduleNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={studentSavingReschedule}
                onClick={() => setStudentReschedulingItem(null)}
                className={btnGhost}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={studentSavingReschedule}
                onClick={handleStudentConfirmReschedule}
                className={btnPrimary}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {studentSavingReschedule ? 'Reagendando...' : 'Confirmar Reagendamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );

  /* =========================================================================
     TELA: CRIANDO / EDITANDO TREINO AGENDADO (Scheduled Workout)
     ========================================================================= */
  if (selectedStudent && editingScheduled) {
    const isSequence = selectedStudent.schedule_type === 'sequence';

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingScheduled(null)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Voltar para a ficha do aluno"
              title="Voltar para a ficha do aluno"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingScheduled === 'new'
                    ? `Agendar Treino — ${selectedStudent.name}`
                    : `Editar Treino Agendado — ${editingScheduled.name}`}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {isSequence ? 'Agenda por Sequência' : 'Agenda por Dias Fixos'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isSequence
                  ? 'Defina a ordem do treino na sequência cíclica e configure os exercícios.'
                  : 'Selecione o(s) dia(s) da semana, período de validade e configure os exercícios.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingScheduled(null)}
              className={btnGhost}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={savingScheduled}
              onClick={handleSaveScheduledWorkout}
              className={btnPrimary}
            >
              {savingScheduled ? 'Salvando...' : 'Salvar Treino na Agenda'}
            </button>
          </div>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />

        {/* Escolha do Método de Inclusão do Treino */}
        <div className={`${cardCls} p-5 space-y-4`}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Como deseja carregar ou montar este treino?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleScheduledSourceChange('template', selectedTemplateForScheduled || templates[0]?.id)}
                className={`p-3 text-left rounded-xl border transition ${
                  scheduledSourceType === 'template'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Carregar de Template
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Importa exercícios de um template pré-definido da organização.
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleScheduledSourceChange(
                    'student_workout',
                    selectedStudentWorkoutForScheduled || studentWorkouts[0]?.id
                  )
                }
                className={`p-3 text-left rounded-xl border transition ${
                  scheduledSourceType === 'student_workout'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Carregar dos Treinos do Aluno
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Copia a lista de um treino livre já cadastrado deste aluno.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleScheduledSourceChange('new')}
                className={`p-3 text-left rounded-xl border transition ${
                  scheduledSourceType === 'new'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Criar Novo Treino
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Monte uma lista de exercícios do zero usando o construtor.
                </div>
              </button>
            </div>
          </div>

          {/* Seletores condicionais da fonte escolhida */}
          {scheduledSourceType === 'template' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Selecione o Template de Treino para carregar:
              </label>
              <select
                value={selectedTemplateForScheduled}
                onChange={(e) => handleScheduledSourceChange('template', e.target.value)}
                className={inputCls}
              >
                <option value="">Selecione um template...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.items.length} exercícios)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 italic">
                * As alterações feitas neste treino agendado não afetarão o template original.
              </p>
            </div>
          )}

          {scheduledSourceType === 'student_workout' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Selecione o Treino do Aluno para carregar:
              </label>
              {studentWorkouts.length === 0 ? (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Este aluno ainda não possui treinos livres cadastrados.
                </div>
              ) : (
                <select
                  value={selectedStudentWorkoutForScheduled}
                  onChange={(e) => handleScheduledSourceChange('student_workout', e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione um treino cadastrado...</option>
                  {studentWorkouts.map((wk) => (
                    <option key={wk.id} value={wk.id}>
                      {wk.name} ({wk.items.length} exercícios)
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-500 italic">
                * As alterações feitas neste treino agendado não afetarão o cadastro base do aluno.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Field label="Nome do Treino *" className={!isSequence ? "md:col-span-4" : "md:col-span-6"}>
              <input
                type="text"
                required
                placeholder="Ex: Treino A - Peito e Tríceps"
                value={scheduledName}
                onChange={(e) => setScheduledName(e.target.value)}
                className={inputCls}
              />
            </Field>

            {!isSequence && (
              <Field label="Horário de Execução (Opcional)" className="md:col-span-2">
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Data de Início (Opcional)" className="md:col-span-3">
              <input
                type="date"
                value={scheduledStartDate}
                onChange={(e) => setScheduledStartDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Data de Fim (Opcional)" className="md:col-span-3">
              <input
                type="date"
                value={scheduledEndDate}
                onChange={(e) => setScheduledEndDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Configuração específica de formato de agenda */}
            {!isSequence ? (
              <div className="md:col-span-12">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Dia(s) da Semana para este Treino *{' '}
                  <span className="text-slate-400 font-normal">
                    {editingScheduled && editingScheduled !== 'new'
                      ? '(Selecione o dia deste treino)'
                      : '(Você pode marcar múltiplos dias para criar o treino neles)'}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((dayName, idx) => {
                    const isSelected = scheduledDaysOfWeek.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleScheduledDay(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Field label="Ordem na Sequência *" className="md:col-span-4">
                <input
                  type="number"
                  min={1}
                  required
                  value={scheduledSequenceOrder}
                  onChange={(e) => setScheduledSequenceOrder(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Observações do Treino (Opcional)" className={isSequence ? 'md:col-span-8' : 'md:col-span-12'}>
              <input
                type="text"
                placeholder="Ex: Aquecimento articular prévio obrigatório..."
                value={scheduledNotes}
                onChange={(e) => setScheduledNotes(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Construtor Reutilizável de Lista de Exercícios */}
        <WorkoutExercisesBuilder items={scheduledItems} onChange={setScheduledItems} />
      </div>
    );
  }

  /* =========================================================================
     TELA: CRIANDO / EDITANDO TREINO LIVRE DO ALUNO
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
                    ? `Cadastrar Treino Livre — ${selectedStudent.name}`
                    : `Editar Treino Livre — ${editingWorkout.name}`}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Treino Livre (Sem vínculo direto com agenda)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Monte ou edite este treino do aluno. Ele pode ser executado avulsamente ou agendado depois.
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
              {savingWorkout ? 'Salvando...' : 'Salvar Treino Livre'}
            </button>
          </div>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />

        <div className={`${cardCls} p-5 space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <Field label="Nome do Treino Livre *" className="md:col-span-5">
              <input
                type="text"
                required
                placeholder="Ex: Treino A - Superiores, Treino B - Inferiores..."
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Observações (Opcional)" className="md:col-span-4">
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
        </div>

        {/* Construtor Reutilizável de Lista de Exercícios */}
        <WorkoutExercisesBuilder items={workoutItems} onChange={setWorkoutItems} />
      </div>
    );
  }

  /* =========================================================================
     VISÃO: FICHA DO ALUNO (Perfil, Agenda e Treinos Livres)
     ========================================================================= */
  if (selectedStudent) {
    const isSequence = selectedStudent.schedule_type === 'sequence';

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
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                  {isSequence ? (
                    <>
                      <Repeat className="w-3 h-3 text-emerald-500" />
                      Agenda por Sequência
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3 h-3 text-emerald-500" />
                      Agenda por Dias Fixos
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ficha individual, agenda de treinos programados e treinos livres
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openModal(selectedStudent)}
              className={btnGhost}
            >
              <Pencil className="w-4 h-4" /> Editar Aluno / Agenda
            </button>
            <button
              type="button"
              onClick={() => startNewScheduledWorkout()}
              className={btnPrimary}
            >
              <Plus className="w-4 h-4" /> Agendar Treino
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
              <span className="font-bold text-slate-700 dark:text-slate-200">Observações: </span>
              {selectedStudent.notes}
            </div>
          )}
        </div>

        {/* Navegação entre Agenda e Treinos Livres */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setStudentTab('agenda')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              studentTab === 'agenda'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isSequence ? (
              <Repeat className="w-4 h-4" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Agenda de Treinos
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {scheduledWorkouts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStudentTab('free_workouts')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              studentTab === 'free_workouts'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            Treinos Livres (Sem Agenda)
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {studentWorkouts.length}
            </span>
          </button>
        </div>

        {/* CONTEÚDO DA ABA: AGENDA DE TREINOS */}
        {studentTab === 'agenda' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {isSequence ? (
                    <>
                      <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Visualização em Sequência Cíclica ({scheduledWorkouts.length} treinos)
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Visualização em Calendário Semanal ({scheduledWorkouts.length} treinos)
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  {isSequence
                    ? 'O aluno segue os treinos em ordem contínua. Ao concluir o último passo, o ciclo reinicia.'
                    : 'Treinos programados para dias específicos da semana com controle de datas de início e fim.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startNewScheduledWorkout()}
                  className={btnPrimary}
                >
                  <Plus className="w-4 h-4" /> Agendar Novo Treino
                </button>
              </div>
            </div>

            {loadingStudentData && (
              <div className={cardCls}>
                <LoadingState message="Carregando agenda do aluno..." />
              </div>
            )}

            {!loadingStudentData && scheduledWorkouts.length === 0 && (
              <div className={`${cardCls} p-12 text-center space-y-3`}>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Nenhum treino agendado ainda
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {isSequence
                    ? 'Adicione treinos na sequência para compor o ciclo de treinamento de ' +
                      selectedStudent.name +
                      '.'
                    : 'Adicione treinos nos dias da semana para compor a rotina de ' +
                      selectedStudent.name +
                      '.'}
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => startNewScheduledWorkout()}
                    className={btnPrimary}
                  >
                    <Plus className="w-4 h-4" /> Agendar Primeiro Treino
                  </button>
                </div>
              </div>
            )}

            {/* Navegador Semanal na Agenda do Aluno */}
            {!isSequence && (
              <div className={`${cardCls} p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-emerald-500 shadow-xs`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Semana de Atendimentos
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>
                        {studentWeekDays[0].dayFormatted} a {studentWeekDays[6].dayFormatted} de {studentWeekDays[6].date.getFullYear()}
                      </span>
                      {studentWeekOffset === 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300">
                          Esta Semana
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStudentWeekOffset((p) => p - 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentWeekOffset(0)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      studentWeekOffset === 0
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentWeekOffset((p) => p + 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Próxima <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* FORMATO 1: VISUALIZAÇÃO EM CALENDÁRIO SEMANAL (Dias Fixos) */}
            {!loadingStudentData && !isSequence && scheduledWorkouts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 items-start">
                {studentWeekDays.map((day) => {
                  const dayIndex = day.dayIndex;
                  const isWeekend = dayIndex === 0 || dayIndex === 6;

                  // 1. Treinos normais cadastrados para este dia da semana
                  const normalWorkouts = scheduledWorkouts.filter((sw) => {
                    if (sw.day_of_week !== dayIndex) return false;
                    if (sw.start_date && day.dateStr < sw.start_date) return false;
                    if (sw.end_date && day.dateStr > sw.end_date) return false;
                    return true;
                  });

                  // Cruzar com os overrides deste dia
                  const dayItems: {
                    id: string;
                    workout: StudentScheduledWorkout;
                    status: 'scheduled' | 'cancelled' | 'rescheduled_away' | 'rescheduled_here';
                    scheduledTime?: string | null;
                    dateStr: string;
                    originalDate?: string;
                    targetDate?: string | null;
                    targetTime?: string | null;
                    notes?: string | null;
                  }[] = [];

                  for (const wk of normalWorkouts) {
                    const ov = studentOverrides.find(
                      (o) => o.scheduled_workout_id === wk.id && o.original_date === day.dateStr
                    );
                    if (ov) {
                      if (ov.status === 'cancelled') {
                        dayItems.push({
                          id: `${wk.id}_${day.dateStr}_cancelled`,
                          workout: wk,
                          status: 'cancelled',
                          scheduledTime: wk.scheduled_time,
                          dateStr: day.dateStr,
                          originalDate: day.dateStr,
                          notes: ov.notes,
                        });
                      } else if (ov.status === 'rescheduled') {
                        dayItems.push({
                          id: `${wk.id}_${day.dateStr}_rescheduled_away`,
                          workout: wk,
                          status: 'rescheduled_away',
                          scheduledTime: wk.scheduled_time,
                          dateStr: day.dateStr,
                          originalDate: day.dateStr,
                          targetDate: ov.rescheduled_date,
                          targetTime: ov.rescheduled_time,
                          notes: ov.notes,
                        });
                      }
                    } else {
                      dayItems.push({
                        id: `${wk.id}_${day.dateStr}`,
                        workout: wk,
                        status: 'scheduled',
                        scheduledTime: wk.scheduled_time,
                        dateStr: day.dateStr,
                        originalDate: day.dateStr,
                      });
                    }
                  }

                  // 2. Treinos reagendados PARA este dia
                  const rescheduledHere = studentOverrides.filter(
                    (o) => o.status === 'rescheduled' && o.rescheduled_date === day.dateStr
                  );
                  for (const ov of rescheduledHere) {
                    const wk = scheduledWorkouts.find((w) => w.id === ov.scheduled_workout_id);
                    if (wk) {
                      dayItems.push({
                        id: `${wk.id}_${day.dateStr}_rescheduled_here`,
                        workout: wk,
                        status: 'rescheduled_here',
                        scheduledTime: ov.rescheduled_time || wk.scheduled_time,
                        dateStr: day.dateStr,
                        originalDate: ov.original_date,
                        notes: ov.notes,
                      });
                    }
                  }

                  dayItems.sort((a, b) =>
                    (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99')
                  );

                  return (
                    <div
                      key={dayIndex}
                      className={`flex flex-col rounded-2xl border transition min-h-[460px] ${
                        day.isToday
                          ? 'bg-white dark:bg-slate-900 border-emerald-500/80 dark:border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-md'
                          : dayItems.length > 0
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                          : 'bg-slate-50/70 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Cabeçalho do Dia */}
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
                          <div className={`text-xs font-bold truncate flex items-center gap-1.5 ${day.isToday ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            <span>{day.dayName}</span>
                            <span className={`text-[10px] font-medium ${day.isToday ? 'text-emerald-100' : 'text-slate-400'}`}>
                              ({day.dayFormatted})
                            </span>
                            {day.isToday && (
                              <span className="text-[9px] font-black uppercase px-1 rounded bg-white text-emerald-700">
                                Hoje
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] font-medium ${day.isToday ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {dayItems.length === 0
                              ? 'Livre / Descanso'
                              : `${dayItems.length} treino(s)`}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => startNewScheduledWorkout(dayIndex)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                            day.isToday
                              ? 'bg-white/20 border-white/40 text-white hover:bg-white hover:text-emerald-700'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-500'
                          }`}
                          title={`Adicionar treino na ${day.dayName}`}
                          aria-label={`Adicionar treino na ${day.dayName}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Lista de Treinos do Dia */}
                      <div className="p-2.5 flex-1 flex flex-col space-y-2.5">
                        {dayItems.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                            <span className="text-[11px] italic">Sem treinos</span>
                            <button
                              type="button"
                              onClick={() => startNewScheduledWorkout(dayIndex)}
                              className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              + Incluir treino
                            </button>
                          </div>
                        ) : (
                          dayItems.map((item) => {
                            const isCancelled = item.status === 'cancelled';
                            const isRescheduledAway = item.status === 'rescheduled_away';
                            const isRescheduledHere = item.status === 'rescheduled_here';
                            const wk = item.workout;

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-xl border transition group flex flex-col justify-between gap-2 shadow-xs ${
                                  isCancelled
                                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 opacity-80'
                                    : isRescheduledAway
                                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 opacity-80'
                                    : isRescheduledHere
                                    ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
                                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500/50'
                                }`}
                              >
                                <div>
                                  {/* Cabeçalho do Card */}
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className={`font-bold text-xs line-clamp-2 ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                          {wk.name}
                                        </h4>
                                        {isCancelled ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                                            <Ban className="w-2.5 h-2.5" /> Cancelado no dia
                                          </span>
                                        ) : isRescheduledAway ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                                            <ArrowRightLeft className="w-2.5 h-2.5" /> Reagendado
                                          </span>
                                        ) : isRescheduledHere ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                                            <Clock className="w-2.5 h-2.5" /> {item.scheduledTime || 'Sem horário'} • Reagendado
                                          </span>
                                        ) : item.scheduledTime ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 shrink-0">
                                            <Clock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                            {item.scheduledTime}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    {/* Ações de Edição Base do Treino */}
                                    <div className="flex items-center gap-0.5 opacity-90 group-hover:opacity-100 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => startEditScheduledWorkout(wk)}
                                        className="p-1 hover:text-emerald-600 text-slate-400 rounded cursor-pointer"
                                        title="Editar cadastro deste treino"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateScheduledWorkout(wk)}
                                        className="p-1 hover:text-emerald-600 text-slate-400 rounded cursor-pointer"
                                        title="Duplicar treino"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteScheduledWorkout(wk)}
                                        className="p-1 hover:text-rose-600 text-slate-400 rounded cursor-pointer"
                                        title="Excluir treino da agenda"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Informações de Reagendamento / Cancelamento */}
                                  {isRescheduledAway && (
                                    <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 p-1.5 rounded-lg">
                                      Transferido para: <strong>{formatDatePtBr(item.targetDate)}</strong> {item.targetTime ? `às ${item.targetTime}` : ''}
                                      {item.notes && <div className="italic mt-0.5">"{item.notes}"</div>}
                                    </div>
                                  )}

                                  {isRescheduledHere && (
                                    <div className="mt-1 text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-950/40 p-1.5 rounded-lg">
                                      Originalmente de: <strong>{formatDatePtBr(item.originalDate)}</strong>
                                      {item.notes && <div className="italic mt-0.5">"{item.notes}"</div>}
                                    </div>
                                  )}

                                  {isCancelled && item.notes && (
                                    <div className="mt-1 text-[10px] text-rose-700 dark:text-rose-300 italic">
                                      Motivo: "{item.notes}"
                                    </div>
                                  )}

                                  {(wk.start_date || wk.end_date) && !isCancelled && !isRescheduledAway && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                      <Clock className="w-2.5 h-2.5 shrink-0" />
                                      <span>
                                        {wk.start_date ? formatDatePtBr(wk.start_date) : 'Início'}
                                        {' até '}
                                        {wk.end_date ? formatDatePtBr(wk.end_date) : 'Indeterminado'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                    <Dumbbell className="w-3 h-3" />
                                    {wk.items.length} exercício(s)
                                  </div>

                                  {wk.notes && (
                                    <div className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">
                                      {wk.notes}
                                    </div>
                                  )}
                                </div>

                                {/* Exercícios resumo */}
                                {!isCancelled && !isRescheduledAway && wk.items.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 space-y-1">
                                    {wk.items.slice(0, 3).map((it, i) => (
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
                                    {wk.items.length > 3 && (
                                      <div className="text-[9px] text-slate-400 italic">
                                        +{wk.items.length - 3} mais exercícios...
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Ações de Reagendar / Cancelar / Restaurar atendimento da data */}
                                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between gap-1 text-[10px]">
                                  {isCancelled || isRescheduledAway || isRescheduledHere ? (
                                    <button
                                      type="button"
                                      onClick={() => handleStudentRestore(wk.id, item.originalDate || item.dateStr)}
                                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                      title="Restaurar atendimento para o padrão semanal original"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Restaurar Atendimento
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudentReschedulingItem({
                                            workout: wk,
                                            dateStr: day.dateStr,
                                            scheduledTime: item.scheduledTime,
                                          });
                                          setStudentRescheduleDate(day.dateStr);
                                          setStudentRescheduleTime(item.scheduledTime || '');
                                          setStudentRescheduleNotes('');
                                        }}
                                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                                        title="Reagendar atendimento desta data"
                                      >
                                        <CalendarClock className="w-3 h-3" /> Reagendar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudentCancellingItem({
                                            workout: wk,
                                            dateStr: day.dateStr,
                                            scheduledTime: item.scheduledTime,
                                          });
                                          setStudentCancelNotes('');
                                        }}
                                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                                        title="Cancelar atendimento apenas deste dia"
                                      >
                                        <Ban className="w-3 h-3" /> Cancelar
                                      </button>
                                    </>
                                  )}
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

            {/* FORMATO 2: VISUALIZAÇÃO EM SEQUÊNCIA (Cards Cíclicos) */}
            {!loadingStudentData && isSequence && scheduledWorkouts.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[...scheduledWorkouts]
                    .sort((a, b) => (a.sequence_order || 1) - (b.sequence_order || 1))
                    .map((wk, idx, array) => {
                      const isFirst = idx === 0;
                      const isLast = idx === array.length - 1;

                      return (
                        <div
                          key={wk.id}
                          className={`${cardCls} p-5 flex flex-col justify-between gap-4 border-l-4 border-l-emerald-500 hover:border-emerald-500/80 transition relative shadow-sm`}
                        >
                          <div className="space-y-3">
                            {/* Topo do Card de Sequência */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs">
                                    {wk.sequence_order || idx + 1}
                                  </span>
                                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                    Passo {wk.sequence_order || idx + 1} da Sequência
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                                  {wk.name}
                                </h3>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={() => handleMoveSequenceOrder(wk, 'up')}
                                  className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 ${
                                    isFirst
                                      ? 'opacity-30 cursor-not-allowed text-slate-400'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer'
                                  }`}
                                  title="Mover treino para trás na sequência"
                                  aria-label="Mover para cima"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={() => handleMoveSequenceOrder(wk, 'down')}
                                  className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 ${
                                    isLast
                                      ? 'opacity-30 cursor-not-allowed text-slate-400'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer'
                                  }`}
                                  title="Mover treino para frente na sequência"
                                  aria-label="Mover para baixo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditScheduledWorkout(wk)}
                                  className={btnIcon}
                                  title="Editar treino da sequência"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateScheduledWorkout(wk)}
                                  className={btnIcon}
                                  title="Duplicar treino"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduledWorkout(wk)}
                                  className={`${btnIcon} hover:text-rose-600`}
                                  title="Excluir treino da sequência"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Validade */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {(wk.start_date || wk.end_date) ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {wk.start_date ? formatDatePtBr(wk.start_date) : 'Início'}
                                  {' até '}
                                  {wk.end_date ? formatDatePtBr(wk.end_date) : 'Indeterminado'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  Sem limite de validade de datas
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Dumbbell className="w-3 h-3" />
                                {wk.items.length} exercício(s)
                              </span>
                            </div>

                            {wk.notes && (
                              <p className="text-xs text-slate-500 italic">{wk.notes}</p>
                            )}

                            {/* Exercícios do Treino */}
                            {wk.items.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                Nenhum exercício adicionado a este treino.
                              </p>
                            ) : (
                              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                {wk.items.map((item, i) => {
                                  const schemeMeta =
                                    SCHEME_TYPES_INFO[item.scheme_type] ||
                                    SCHEME_TYPES_INFO.series_retas;
                                  return (
                                    <div
                                      key={item.id || `${item.exercise_id}-${i}`}
                                      className="flex items-center justify-between gap-2 text-xs py-1"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                                          {i + 1}
                                        </span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                          {item.exercise_name}
                                        </span>
                                      </div>
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${schemeMeta.badgeCls}`}
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

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                              Próximo:{' '}
                              {isLast ? (
                                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Reinicia no Passo 1 ⟳
                                </strong>
                              ) : (
                                `Passo ${(wk.sequence_order || idx + 1) + 1}`
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditScheduledWorkout(wk)}
                              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              Editar treino →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Card visual de fechamento do ciclo */}
                <div className="p-4 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        Ciclo Contínuo de Treinamento
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Após o Aluno concluir o treino {scheduledWorkouts.length}, ele retornará automaticamente ao treino 1.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startNewScheduledWorkout()}
                    className={btnPrimary}
                  >
                    <Plus className="w-4 h-4" /> Adicionar Mais um Passo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: TREINOS LIVRES (SEM AGENDA) */}
        {studentTab === 'free_workouts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Treinos Livres ({studentWorkouts.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Treinos avulsos do aluno que não dependem de dia da semana ou sequência cíclica. Podem ser agendados a qualquer momento.
                </p>
              </div>

              <button
                type="button"
                onClick={startNewStudentWorkout}
                className={btnPrimary}
              >
                <Plus className="w-4 h-4" /> Cadastrar Treino Livre
              </button>
            </div>

            {loadingStudentData && (
              <div className={cardCls}>
                <LoadingState message="Carregando treinos livres do aluno..." />
              </div>
            )}

            {!loadingStudentData && studentWorkouts.length === 0 && (
              <div className={`${cardCls} p-12 text-center space-y-3`}>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Nenhum treino livre cadastrado
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Crie treinos livres caso queira manter fichas de exercícios adicionais para este aluno fora do formato de agenda.
                </p>
                <div>
                  <button type="button" onClick={startNewStudentWorkout} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Cadastrar Treino Livre
                  </button>
                </div>
              </div>
            )}

            {!loadingStudentData && studentWorkouts.length > 0 && (
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
                            onClick={() => handleScheduleFreeWorkout(wk)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                            title="Agendar este treino na rotina do aluno"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Agendar
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditStudentWorkout(wk)}
                            className={btnIcon}
                            title="Editar treino livre"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateStudentWorkout(wk)}
                            className={btnIcon}
                            title="Duplicar treino livre"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudentWorkout(wk)}
                            className={`${btnIcon} hover:text-rose-600`}
                            title="Excluir treino livre"
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

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <button
                        type="button"
                        onClick={() => handleScheduleFreeWorkout(wk)}
                        className="font-medium text-slate-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Copiar para a Agenda
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditStudentWorkout(wk)}
                        className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Abrir e editar treino →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {studentModals}
      </div>
    );
  }

  /* =========================================================================
     VISÃO: LISTAGEM GERAL DE ALUNOS
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
            Cadastre seus alunos e acesse a ficha individual para gerenciar a agenda e a programação de treinos.
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
              <th className="text-left px-4 py-3.5">Formato Agenda</th>
              <th className="text-left px-4 py-3.5">Treinos Agendados</th>
              <th className="text-left px-4 py-3.5">Gênero</th>
              <th className="text-left px-4 py-3.5">Telefone</th>
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
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {s.schedule_type === 'sequence' ? (
                        <>
                          <Repeat className="w-3 h-3 text-emerald-500" />
                          Sequência Cíclica
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3 h-3 text-emerald-500" />
                          Dias Fixos
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {s.scheduled_workouts_count ?? 0} agendado(s)
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.gender}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{s.phone}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition cursor-pointer"
                      title="Abrir ficha, agenda e treinos do aluno"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Ficha / Agenda
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
