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
