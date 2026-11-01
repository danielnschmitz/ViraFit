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

export interface Student {
  id: string;
  organization_id: string;
  name: string;
  document: string;
  phone: string;
  gender: 'Masculino' | 'Feminino' | 'Outro';
  group_id?: string | null;
  group_name: string;
  notes?: string | null;
  email?: string | null;
  zip_code?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  delivery_instructions?: string | null;
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
