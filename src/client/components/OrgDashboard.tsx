import React, { useEffect, useState } from 'react';
import {
  Dumbbell,
  GraduationCap,
  Layers,
  Star,
  Tags,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Organization, apiFetch } from '../api';
import { LoadingState, cardCls } from './ui';

interface OrgDashboardProps {
  org: Organization;
  onNavigate: (view: 'students' | 'exercises', subTab?: 'exercises' | 'muscle_groups' | 'categories') => void;
}

export const OrgDashboard: React.FC<OrgDashboardProps> = ({ org, onNavigate }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/org/summary')
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState message="Carregando painel..." />;
  }

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          {org.logo ? (
            <img
              src={org.logo}
              alt={org.name}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xl">
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{org.name}</h1>
            <p className="text-sm text-slate-500">
              Visão geral de alunos, exercícios, grupos musculares e categorias.
            </p>
          </div>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${cardCls} p-5`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total de Alunos</span>
                <GraduationCap className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.students.total} <span className="text-sm font-normal text-slate-400">/ {org.max_students ?? 100}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {summary.students.presencial} presencial • {summary.students.online} online
              </p>
            </div>

            <div className={`${cardCls} p-5`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Exercícios</span>
                <Dumbbell className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.exercises.total}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {summary.exercises.favorites} favorito(s)
              </p>
            </div>

            <div className={`${cardCls} p-5`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Grupos Musculares</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.muscle_groups_count}
              </div>
              <p className="text-xs text-slate-500 mt-1">Cadastrados na organização</p>
            </div>

            <div className={`${cardCls} p-5`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Categorias</span>
                <Tags className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.categories_count}
              </div>
              <p className="text-xs text-slate-500 mt-1">Modalidades de treino</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {org.mod_students !== false && (
              <div className={`${cardCls} p-6 flex flex-col justify-between gap-4`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      Alunos por Grupo
                    </h2>
                  </div>
                  {summary.studentsByGroup.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4">Nenhum aluno cadastrado ainda.</p>
                  ) : (
                    <div className="space-y-2.5 mt-3">
                      {summary.studentsByGroup.map((g: { group_name: string; count: number }) => (
                        <div key={g.group_name} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{g.group_name}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {g.count} aluno(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('students')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800"
                >
                  Acessar Gestão de Alunos <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {org.mod_exercises !== false && (
              <div className={`${cardCls} p-6 flex flex-col justify-between gap-4`}>
                <div>
                  <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <Dumbbell className="w-5 h-5 text-amber-500" />
                    Biblioteca de Exercícios e Mídias
                  </h2>
                  <div className="grid grid-cols-3 gap-3 text-center mt-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.exercises.photos}</div>
                      <div className="text-xs text-slate-500">Fotos / GIFs</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.exercises.videos}</div>
                      <div className="text-xs text-slate-500">Vídeos</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.exercises.youtube}</div>
                      <div className="text-xs text-slate-500">YouTube</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onNavigate('exercises', 'exercises')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Ver Exercícios <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('exercises', 'muscle_groups')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Grupos Musculares
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('exercises', 'categories')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Categorias
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
