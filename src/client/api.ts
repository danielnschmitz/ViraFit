export interface Organization {
  id: string;
  name: string;
  document?: string | null;
  phone: string;
  notes?: string | null;
  logo?: string | null;
  max_admins: number;
  max_users: number;
  max_students: number;
  mod_students: boolean;
  mod_exercises: boolean;
  admin_count?: number;
  standard_count?: number;
  students_count?: number;
  exercises_count?: number;
  created_at?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  role: 'master' | 'admin' | 'standard';
  organization_id: string | null;
  organization_name?: string | null;
  active?: boolean;
  must_change_password?: boolean;
  organization?: Organization | null;
}

export interface StudentGroup {
  id: string;
  organization_id: string;
  name: string;
  students_count?: number;
}

export type ScheduleType = 'fixed_days' | 'sequence';

export interface Student {
  id: string;
  organization_id: string;
  name: string;
  document: string;
  phone: string;
  gender: 'Masculino' | 'Feminino' | 'Outro';
  group_id?: string | null;
  group_name: string;
  schedule_type?: ScheduleType;
  notes?: string | null;
  email?: string | null;
  zip_code?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  delivery_instructions?: string | null;
  workouts_count?: number;
  scheduled_workouts_count?: number;
  created_at?: string;
}

export interface MuscleGroup {
  id: string;
  organization_id: string;
  name: string;
  exercises_count?: number;
}

export interface ExerciseCategory {
  id: string;
  organization_id: string;
  name: string;
  exercises_count?: number;
}

export interface Exercise {
  id: string;
  organization_id: string;
  name: string;
  media_type: 'none' | 'photo_gif' | 'video' | 'youtube';
  media_url?: string | null;
  muscle_group_id: string;
  muscle_group_name?: string;
  category_id: string;
  category_name?: string;
  is_favorite: boolean;
  created_at?: string;
}

export type SchemeType = 'series_retas' | 'piramide' | 'drop_set' | 'rest_pause' | 'ate_a_falha';
export type RepUnit = 'reps' | 'seconds' | 'minutes';
export type RestUnit = 'seconds' | 'minutes';

export interface ExerciseScheme {
  id: string;
  organization_id: string;
  name: string;
  scheme_type: SchemeType;
  sets: number;
  reps: string;
  rep_unit: RepUnit;
  rest_time?: string | null;
  rest_unit?: RestUnit;
  is_default: boolean;
  created_at?: string;
}

export interface WorkoutExerciseItem {
  id?: string;
  exercise_id: string;
  exercise_name: string;
  media_type?: Exercise['media_type'];
  media_url?: string | null;
  muscle_group_id?: string;
  muscle_group_name?: string;
  category_id?: string;
  category_name?: string;
  is_favorite?: boolean;
  scheme_id?: string | null;
  scheme_name: string;
  scheme_type: SchemeType;
  sets: number;
  reps: string;
  rep_unit: RepUnit;
  rest_time?: string | null;
  rest_unit?: RestUnit;
  weight?: string | null;
  notes?: string | null;
}

export interface WorkoutTemplate {
  id: string;
  organization_id: string;
  name: string;
  student_group_id?: string | null;
  student_group_name: string;
  items: WorkoutExerciseItem[];
  created_at?: string;
  updated_at?: string;
}

export interface StudentWorkout {
  id: string;
  organization_id: string;
  student_id: string;
  name: string;
  notes?: string | null;
  items: WorkoutExerciseItem[];
  created_at?: string;
  updated_at?: string;
}

export interface StudentScheduledWorkout {
  id: string;
  organization_id: string;
  student_id: string;
  name: string;
  notes?: string | null;
  schedule_type: ScheduleType;
  day_of_week?: number | null; // 0 a 6
  scheduled_time?: string | null; // HH:mm (ex: "07:30")
  sequence_order?: number | null; // 1, 2, 3...
  start_date?: string | null;
  end_date?: string | null;
  items: WorkoutExerciseItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PersonalScheduledWorkoutItem extends StudentScheduledWorkout {
  student_name: string;
  student_phone?: string | null;
  student_email?: string | null;
  student_gender?: Student['gender'];
  student_group_name?: string;
  student_schedule_type?: ScheduleType;
}

export interface ScheduledWorkoutOverride {
  id: string;
  organization_id: string;
  scheduled_workout_id: string;
  student_id: string;
  original_date: string; // 'YYYY-MM-DD'
  status: 'cancelled' | 'rescheduled' | 'completed';
  rescheduled_date?: string | null; // 'YYYY-MM-DD'
  rescheduled_time?: string | null; // 'HH:mm'
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  student_name?: string;
  scheduled_workout_name?: string;
}

export interface PerformedSet {
  set_number: number;
  reps: string;
  weight_kg?: string;
  completed: boolean;
}

export type PhysiologicalIssueType =
  | 'fatigue'
  | 'high_heart_rate'
  | 'dizziness'
  | 'shortness_of_breath'
  | 'joint_pain'
  | 'muscle_pain'
  | 'blood_pressure_drop'
  | 'form_breakdown'
  | 'other';

export interface PhysiologicalIssue {
  id: string;
  type: PhysiologicalIssueType;
  label: string;
  description?: string;
  registered_at: string; // ISO
}

export interface AttendanceSessionItem {
  id: string;
  session_id: string;
  organization_id: string;
  position: number;
  exercise_id: string;
  exercise_name: string;
  muscle_group_name?: string | null;
  category_name?: string | null;
  scheme_name: string;
  scheme_type: SchemeType;
  status: 'completed' | 'not_done';
  reason_not_done?: string | null;
  target_sets: number;
  target_reps: string;
  target_weight?: string | null;
  target_rest_time?: string | null;
  performed_sets: PerformedSet[];
  issues: PhysiologicalIssue[];
  notes?: string | null;
  created_at?: string;
}

export interface AttendanceSession {
  id: string;
  organization_id: string;
  student_id: string;
  scheduled_workout_id?: string | null;
  workout_name: string;
  session_date: string;
  started_at: string;
  completed_at?: string | null;
  duration_seconds: number;
  perceived_effort?: number | null; // 1 a 10
  general_notes?: string | null;
  total_exercises: number;
  completed_exercises: number;
  skipped_exercises: number;
  student_name?: string;
  student_phone?: string | null;
  student_gender?: Student['gender'];
  student_group_name?: string;
  items?: AttendanceSessionItem[];
  created_at?: string;
}

export const PHYSIOLOGICAL_ISSUE_OPTIONS: {
  type: PhysiologicalIssueType;
  label: string;
  descriptionHint: string;
  badgeCls: string;
}[] = [
  {
    type: 'fatigue',
    label: 'Cansaço / Fadiga Excessiva',
    descriptionHint: 'Ex: Aluno sentiu queimação extrema e exaustão muscular rápida',
    badgeCls: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
  },
  {
    type: 'high_heart_rate',
    label: 'Batimentos Muito Elevados',
    descriptionHint: 'Ex: Frequência cardíaca atingiu 175 bpm no frequencímetro',
    badgeCls: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
  },
  {
    type: 'dizziness',
    label: 'Tontura / Vertigem / Vista Escura',
    descriptionHint: 'Ex: Sentiu tontura leve ao levantar do aparelho',
    badgeCls: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
  },
  {
    type: 'shortness_of_breath',
    label: 'Falta de Ar / Respiração Ofegante',
    descriptionHint: 'Ex: Dificuldade para recuperar o fôlego entre as séries',
    badgeCls: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800',
  },
  {
    type: 'joint_pain',
    label: 'Dor Articular / Desconforto',
    descriptionHint: 'Ex: Pontada no joelho direito durante a flexão',
    badgeCls: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-800',
  },
  {
    type: 'muscle_pain',
    label: 'Dor Muscular Aguda / Cãibra',
    descriptionHint: 'Ex: Princípio de cãibra no posterior de coxa',
    badgeCls: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800',
  },
  {
    type: 'blood_pressure_drop',
    label: 'Queda de Pressão / Mal-estar',
    descriptionHint: 'Ex: Suor frio, palidez ou fraqueza repentina',
    badgeCls: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/80 dark:text-yellow-300 dark:border-yellow-800',
  },
  {
    type: 'form_breakdown',
    label: 'Comprometimento da Postura / Técnica',
    descriptionHint: 'Ex: Compensação na lombar por carga excessiva',
    badgeCls: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  {
    type: 'other',
    label: 'Outra Observação / Sintoma',
    descriptionHint: 'Descreva livremente o que o aluno relatou ou manifestou',
    badgeCls: 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
];

export const DAYS_OF_WEEK = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export const DAYS_OF_WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const SCHEME_TYPES_INFO: Record<
  SchemeType,
  { label: string; shortLabel: string; help: string; badgeCls: string }
> = {
  series_retas: {
    label: 'Séries Retas',
    shortLabel: 'Séries Retas',
    help: 'Número fixo de repetições em todas as séries com o mesmo peso e tempo de descanso (ex: 3x10)',
    badgeCls:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  piramide: {
    label: 'Pirâmide',
    shortLabel: 'Pirâmide',
    help: 'Ascendente ou descendente, peso aumenta ou diminui a cada série',
    badgeCls:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  },
  drop_set: {
    label: 'Drop-set',
    shortLabel: 'Drop-set',
    help: 'Fazer a série até a falha, diminuir a carga imediatamente (sem descanso) e continuar fazendo até a nova falha.',
    badgeCls:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  rest_pause: {
    label: 'Rest-Pause',
    shortLabel: 'Rest-Pause',
    help: 'Fazer a série até quase a falha, descansar por 10 a 15 segundos no mesmo aparelho, e espremer mais algumas repetições.',
    badgeCls:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
  ate_a_falha: {
    label: 'Até a Falha',
    shortLabel: 'Até a Falha',
    help: 'Executar o exercício até não conseguir mais mover o peso com boa forma',
    badgeCls:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
};

export const REP_UNIT_LABELS: Record<RepUnit, { label: string; suffix: string }> = {
  reps: { label: 'Quantidade (repetições)', suffix: 'reps' },
  seconds: { label: 'Tempo (segundos)', suffix: 'seg' },
  minutes: { label: 'Tempo (minutos)', suffix: 'min' },
};

export function formatSchemeSummary(item: {
  scheme_type: SchemeType;
  sets: number;
  reps: string;
  rep_unit: RepUnit;
  rest_time?: string | null;
  rest_unit?: RestUnit;
  weight?: string | null;
}): string {
  const unitSuffix =
    item.rep_unit === 'seconds' ? 'seg' : item.rep_unit === 'minutes' ? 'min' : 'reps';
  const typeLabel = SCHEME_TYPES_INFO[item.scheme_type]?.label || 'Séries Retas';
  const cleanWeight = item.weight ? String(item.weight).trim() : '';
  const weightSuffix = cleanWeight ? ` • Peso: ${cleanWeight} kg` : '';
  const cleanRest = item.rest_time ? String(item.rest_time).trim() : '';
  const restSuffix =
    cleanRest && cleanRest !== '0'
      ? ` • Desc: ${cleanRest}${item.rest_unit === 'minutes' ? 'min' : 's'}`
      : '';

  if (item.scheme_type === 'ate_a_falha' && item.reps.toLowerCase().includes('falha')) {
    return `${typeLabel} • ${item.sets}x Até a Falha${weightSuffix}${restSuffix}`;
  }
  if (item.scheme_type === 'piramide') {
    return `${typeLabel} • ${item.sets}x (${item.reps} ${unitSuffix})${weightSuffix}${restSuffix}`;
  }
  return `${typeLabel} • ${item.sets}x ${item.reps} ${unitSuffix}${weightSuffix}${restSuffix}`;
}

const TOKEN_KEY = 'virafit_token';
const ACTIVE_ORG_KEY = 'virafit_active_org_id';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getActiveOrgId(): string | null {
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

export function setActiveOrgId(orgId: string | null) {
  if (orgId) localStorage.setItem(ACTIVE_ORG_KEY, orgId);
  else localStorage.removeItem(ACTIVE_ORG_KEY);
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const activeOrgId = getActiveOrgId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeOrgId) {
    headers['x-org-id'] = activeOrgId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (${res.status})`);
  }
  return data as T;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function extractYoutubeId(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}
