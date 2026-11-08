import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  Clock,
  Dumbbell,
  User,
  Plus,
  Minus,
  Check,
  ChevronRight,
  Flame,
  Activity,
  ArrowRight,
  Sparkles,
  HelpCircle,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  WorkoutExerciseItem,
  PersonalScheduledWorkoutItem,
  StudentScheduledWorkout,
  SchemeType,
  SCHEME_TYPES_INFO,
  PHYSIOLOGICAL_ISSUE_OPTIONS,
  PhysiologicalIssue,
  PhysiologicalIssueType,
  PerformedSet,
  apiFetch,
  extractYoutubeId,
} from '../api';
import { btnGhost, btnPrimary, cardCls, inputCls } from './ui';

interface AttendanceSessionRunnerProps {
  workout: PersonalScheduledWorkoutItem | StudentScheduledWorkout;
  studentId: string;
  studentName: string;
  studentPhone?: string | null;
  studentGroup?: string | null;
  sessionDate: string; // YYYY-MM-DD
  scheduledWorkoutId?: string | null;
  onClose: () => void;
  onSessionCompleted: () => void;
}

interface WorkingExerciseItem extends WorkoutExerciseItem {
  internalKey: string;
  performedSets: PerformedSet[];
  issues: PhysiologicalIssue[];
  notes?: string;
  reasonNotDone?: string;
}

export const AttendanceSessionRunner: React.FC<AttendanceSessionRunnerProps> = ({
  workout,
  studentId,
  studentName,
  studentPhone,
  studentGroup,
  sessionDate,
  scheduledWorkoutId,
  onClose,
  onSessionCompleted,
}) => {
  // Inicialização da fila de exercícios com estrutura de séries pronta
  const initialQueue = useMemo<WorkingExerciseItem[]>(() => {
    return (workout.items || []).map((it, idx) => {
      const setsCount = Math.max(1, it.sets || 3);
      const initialSets: PerformedSet[] = [];

      // Reps e Pesos iniciais podem ser listas separadas por vírgula em caso de pirâmide/drop-set
      const repsParts = String(it.reps || '10')
        .split(',')
        .map((s) => s.trim());
      const weightParts = String(it.weight || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (let s = 1; s <= setsCount; s++) {
        const targetReps = repsParts[s - 1] || repsParts[0] || '10';
        const targetWeight = weightParts[s - 1] || weightParts[0] || '';
        initialSets.push({
          set_number: s,
          reps: targetReps,
          weight_kg: targetWeight,
          completed: false,
        });
      }

      return {
        ...it,
        internalKey: `${it.exercise_id}_${idx}_${Date.now()}`,
        performedSets: initialSets,
        issues: [],
        notes: it.notes || '',
      };
    });
  }, [workout]);

  // Fila de pendentes
  const [queue, setQueue] = useState<WorkingExerciseItem[]>(initialQueue);
  // Itens finalizados com sucesso
  const [completedItems, setCompletedItems] = useState<WorkingExerciseItem[]>([]);
  // Itens marcados como não realizados
  const [skippedItems, setSkippedItems] = useState<WorkingExerciseItem[]>([]);

  // Notificação toast interna
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cronômetro da Sessão
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const startTimeRef = useRef<Date>(new Date());

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Cronômetro de Descanso entre séries
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);
  const [restInitialSeconds, setRestInitialSeconds] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    let timer: any = null;
    if (restSecondsRemaining !== null && restSecondsRemaining > 0) {
      timer = setInterval(() => {
        setRestSecondsRemaining((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (restSecondsRemaining === 0) {
      // Beep ou feedback
      if (soundEnabled && typeof window !== 'undefined' && (window as any).AudioContext) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch {
          // Áudio indisponível
        }
      }
    }
    return () => clearInterval(timer);
  }, [restSecondsRemaining, soundEnabled]);

  const startRestTimer = (seconds: number) => {
    if (seconds <= 0) return;
    setRestInitialSeconds(seconds);
    setRestSecondsRemaining(seconds);
  };

  const stopRestTimer = () => {
    setRestSecondsRemaining(null);
  };

  // Estado da Tela de Conclusão Final
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [perceivedEffort, setPerceivedEffort] = useState<number>(7);
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [savingSession, setSavingSession] = useState<boolean>(false);

  // Modal para registrar intercorrência
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [selectedIssueType, setSelectedIssueType] = useState<PhysiologicalIssueType>('fatigue');
  const [customIssueDesc, setCustomIssueDesc] = useState<string>('');

  // Modal para marcar exercício como não realizado
  const [isNotDoneModalOpen, setIsNotDoneModalOpen] = useState<boolean>(false);
  const [notDoneReason, setNotDoneReason] = useState<string>('');

  // Modal de Demonstração / Mídia do Exercício
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);

  // Exercício atual em foco
  const currentItem = queue[0] || null;

  // Total original de exercícios
  const totalExercises = initialQueue.length;
  const processedCount = completedItems.length + skippedItems.length;

  // Atualizar séries do exercício atual
  const updateCurrentSet = (setNumber: number, field: keyof PerformedSet, val: any) => {
    if (!currentItem) return;
    setQueue((prevQueue) => {
      const copy = [...prevQueue];
      const target = { ...copy[0] };
      target.performedSets = target.performedSets.map((s) => {
        if (s.set_number === setNumber) {
          return { ...s, [field]: val };
        }
        return s;
      });
      copy[0] = target;
      return copy;
    });
  };

  const toggleSetCompleted = (setNumber: number) => {
    if (!currentItem) return;
    const currentSet = currentItem.performedSets.find((s) => s.set_number === setNumber);
    const willComplete = !currentSet?.completed;

    updateCurrentSet(setNumber, 'completed', willComplete);

    // Se completou a série, iniciar timer de descanso configurado
    if (willComplete) {
      const parsedRest = parseInt(currentItem.rest_time || '0', 10);
      const restSec = currentItem.rest_unit === 'minutes' ? parsedRest * 60 : parsedRest;
      if (restSec > 0) {
        startRestTimer(restSec);
      }
    }
  };

  // Adicionar série extra
  const addSet = () => {
    if (!currentItem) return;
    setQueue((prevQueue) => {
      const copy = [...prevQueue];
      const target = { ...copy[0] };
      const nextNum = target.performedSets.length + 1;
      const lastSet = target.performedSets[target.performedSets.length - 1];
      target.performedSets = [
        ...target.performedSets,
        {
          set_number: nextNum,
          reps: lastSet?.reps || '10',
          weight_kg: lastSet?.weight_kg || '',
          completed: false,
        },
      ];
      copy[0] = target;
      return copy;
    });
  };

  // Remover última série
  const removeLastSet = () => {
    if (!currentItem || currentItem.performedSets.length <= 1) return;
    setQueue((prevQueue) => {
      const copy = [...prevQueue];
      const target = { ...copy[0] };
      target.performedSets = target.performedSets.slice(0, -1);
      copy[0] = target;
      return copy;
    });
  };

  // 1. AÇÃO: PULAR EXERCÍCIO (vai para o fim da fila)
  const handleSkipExerciseToBack = () => {
    if (!currentItem) return;
    stopRestTimer();

    if (queue.length <= 1) {
      showToast('Este é o único exercício restante na fila!');
      return;
    }

    setQueue((prevQueue) => {
      const [first, ...rest] = prevQueue;
      return [...rest, first];
    });

    showToast(`"${currentItem.exercise_name}" foi movido para o final da fila`);
  };

  // 2. AÇÃO: REGISTRAR INTERCORRÊNCIA / SINTOMA FÍSICO
  const handleSaveIssue = () => {
    if (!currentItem) return;

    const opt = PHYSIOLOGICAL_ISSUE_OPTIONS.find((o) => o.type === selectedIssueType);
    const newIssue: PhysiologicalIssue = {
      id: crypto.randomUUID(),
      type: selectedIssueType,
      label: opt?.label || 'Intercorrência',
      description: customIssueDesc.trim() || undefined,
      registered_at: new Date().toISOString(),
    };

    setQueue((prevQueue) => {
      const copy = [...prevQueue];
      const target = { ...copy[0] };
      target.issues = [...target.issues, newIssue];
      copy[0] = target;
      return copy;
    });

    setIsIssueModalOpen(false);
    setCustomIssueDesc('');
    showToast(`Intercorrência registrada: ${newIssue.label}`);
  };

  const removeIssue = (issueId: string) => {
    if (!currentItem) return;
    setQueue((prevQueue) => {
      const copy = [...prevQueue];
      const target = { ...copy[0] };
      target.issues = target.issues.filter((i) => i.id !== issueId);
      copy[0] = target;
      return copy;
    });
  };

  // 3. AÇÃO: MARCAR COMO NÃO REALIZADO
  const handleConfirmNotDone = () => {
    if (!currentItem) return;
    stopRestTimer();

    const finalizedItem: WorkingExerciseItem = {
      ...currentItem,
      reasonNotDone: notDoneReason.trim() || 'Não realizado',
    };

    setSkippedItems((prev) => [...prev, finalizedItem]);
    setQueue((prev) => prev.slice(1));
    setIsNotDoneModalOpen(false);
    setNotDoneReason('');

    showToast(`"${currentItem.exercise_name}" marcado como não realizado`);

    // Se não há mais itens, vai para o fechamento
    if (queue.length === 1) {
      setIsFinishing(true);
    }
  };

  // 4. AÇÃO: FINALIZAR EXERCÍCIO (avança para o próximo)
  const handleCompleteExercise = () => {
    if (!currentItem) return;
    stopRestTimer();

    // Garante que todas as séries sejam marcadas como completed se o personal avançou
    const completedSets = currentItem.performedSets.map((s) => ({
      ...s,
      completed: true,
    }));

    const finalizedItem: WorkingExerciseItem = {
      ...currentItem,
      performedSets: completedSets,
    };

    setCompletedItems((prev) => [...prev, finalizedItem]);
    setQueue((prev) => prev.slice(1));

    showToast(`✓ "${currentItem.exercise_name}" concluído!`);

    // Se era o último, abre a tela de finalização do treino
    if (queue.length === 1) {
      setIsFinishing(true);
    }
  };

  // 5. AÇÃO: SALVAR E CONCLUIR ATENDIMENTO
  const handleSaveSession = async () => {
    setSavingSession(true);
    try {
      const allSessionItems = [
        ...completedItems.map((it) => ({
          exercise_id: it.exercise_id,
          exercise_name: it.exercise_name,
          muscle_group_name: it.muscle_group_name,
          category_name: it.category_name,
          scheme_name: it.scheme_name,
          scheme_type: it.scheme_type,
          status: 'completed',
          reason_not_done: null,
          target_sets: it.sets,
          target_reps: it.reps,
          target_weight: it.weight,
          target_rest_time: it.rest_time,
          performed_sets: it.performedSets,
          issues: it.issues,
          notes: it.notes,
        })),
        ...skippedItems.map((it) => ({
          exercise_id: it.exercise_id,
          exercise_name: it.exercise_name,
          muscle_group_name: it.muscle_group_name,
          category_name: it.category_name,
          scheme_name: it.scheme_name,
          scheme_type: it.scheme_type,
          status: 'not_done',
          reason_not_done: it.reasonNotDone || 'Não realizado',
          target_sets: it.sets,
          target_reps: it.reps,
          target_weight: it.weight,
          target_rest_time: it.rest_time,
          performed_sets: it.performedSets,
          issues: it.issues,
          notes: it.notes,
        })),
        // Se ainda sobrou itens na fila (finalizado prematuramente pelo botão "Finalizar Treino")
        ...queue.map((it) => ({
          exercise_id: it.exercise_id,
          exercise_name: it.exercise_name,
          muscle_group_name: it.muscle_group_name,
          category_name: it.category_name,
          scheme_name: it.scheme_name,
          scheme_type: it.scheme_type,
          status: 'not_done',
          reason_not_done: 'Interrompido antes da execução',
          target_sets: it.sets,
          target_reps: it.reps,
          target_weight: it.weight,
          target_rest_time: it.rest_time,
          performed_sets: it.performedSets,
          issues: it.issues,
          notes: it.notes,
        })),
      ];

      await apiFetch('/api/org/attendance-sessions', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          scheduled_workout_id: scheduledWorkoutId || null,
          workout_name: workout.name,
          session_date: sessionDate,
          started_at: startTimeRef.current.toISOString(),
          completed_at: new Date().toISOString(),
          duration_seconds: secondsElapsed,
          perceived_effort: perceivedEffort,
          general_notes: generalNotes.trim() || null,
          items: allSessionItems,
        }),
      });

      onSessionCompleted();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar atendimento.');
    } finally {
      setSavingSession(false);
    }
  };

  // Se o personal tentar fechar antes de finalizar
  const handleRequestClose = () => {
    if (completedItems.length > 0 || skippedItems.length > 0) {
      if (!window.confirm('Há um atendimento em andamento com registros feitos. Deseja realmente sair sem salvar?')) {
        return;
      }
    }
    onClose();
  };

  const schemeMeta = currentItem
    ? SCHEME_TYPES_INFO[currentItem.scheme_type] || SCHEME_TYPES_INFO.series_retas
    : SCHEME_TYPES_INFO.series_retas;

  // Informações de Mídia
  const youtubeId = currentItem ? extractYoutubeId(currentItem.media_url) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white font-sans select-none overflow-hidden touch-manipulation">
      {/* Toast Notificação Flutuante */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* BARRA SUPERIOR (HEADER) */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-md">
        {/* Aluno & Treino */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-slate-100 truncate flex items-center gap-1.5">
              <span>{studentName}</span>
              {studentGroup && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {studentGroup}
                </span>
              )}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold truncate flex items-center gap-1">
              <Dumbbell className="w-3 h-3 shrink-0" />
              <span>{workout.name}</span>
            </div>
          </div>
        </div>

        {/* Cronômetro Central e Ações do Topo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Cronômetro */}
          <div
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold cursor-pointer transition ${
              isTimerRunning
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
            }`}
            title={isTimerRunning ? 'Pausar cronômetro' : 'Continuar cronômetro'}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimerRunning ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
            <span>{formatTimer(secondsElapsed)}</span>
            <span className="text-[9px] uppercase font-sans opacity-70 hidden sm:inline">
              {isTimerRunning ? 'Ativo' : 'Pausa'}
            </span>
          </div>

          {/* Botão Finalizar Treino (a qualquer momento) */}
          <button
            type="button"
            onClick={() => setIsFinishing(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            title="Finalizar atendimento a qualquer momento"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Finalizar Treino</span>
          </button>

          {/* Fechar / Sair */}
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cancelar e sair"
            aria-label="Sair do atendimento"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* BARRA DE PROGRESSO VISUAL DA SESSÃO */}
      <div className="shrink-0 bg-slate-900/60 px-4 py-1.5 border-b border-slate-800 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-300">
            Exercício {Math.min(totalExercises, processedCount + 1)} de {totalExercises}
          </span>
          <span className="opacity-50">•</span>
          <span className="truncate">
            Fila: <strong>{queue.length} restantes</strong>
          </span>
          {completedItems.length > 0 && (
            <span className="text-emerald-400 font-semibold hidden sm:inline">
              ({completedItems.length} concluídos)
            </span>
          )}
        </div>

        {/* Mini barra de progresso */}
        <div className="w-24 sm:w-36 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: `${totalExercises > 0 ? (processedCount / totalExercises) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* TIMER DE DESCANSO REGRESSIVO FLUTUANTE (Se ativo) */}
      {restSecondsRemaining !== null && (
        <div className="shrink-0 bg-indigo-950/90 border-b border-indigo-800 px-4 py-2 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-bold text-indigo-200">Tempo de Descanso:</span>
            <span className="font-mono text-base font-black text-white">
              {formatTimer(restSecondsRemaining)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 text-indigo-300 hover:text-white rounded"
              title={soundEnabled ? 'Silenciar som' : 'Ativar som de término'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setRestSecondsRemaining((prev) => (prev ? prev + 15 : 15))}
              className="px-2 py-0.5 rounded bg-indigo-800 text-indigo-200 text-[10px] font-bold hover:bg-indigo-700"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={stopRestTimer}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Pular Descanso
            </button>
          </div>
        </div>
      )}

      {/* ÁREA CENTRAL PRINCIPAL: EXERCÍCIO DA VEZ */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col max-w-3xl mx-auto w-full space-y-4">
        {/* Caso a fila esteja vazia e fomos para a finalização */}
        {(!currentItem || isFinishing) ? (
          <div className="flex-1 flex flex-col justify-center items-center py-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">Concluir Atendimento</h2>
              <p className="text-xs text-slate-400">
                Revise os dados deste treino e informe as observações finais para a ficha de {studentName}.
              </p>
            </div>

            {/* Cartões Estatísticos */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
              <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Tempo Total</div>
                <div className="text-lg sm:text-xl font-mono font-bold text-emerald-400 mt-1">
                  {formatTimer(secondsElapsed)}
                </div>
              </div>
              <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Concluídos</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
                  {completedItems.length}
                </div>
              </div>
              <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Não Feitos</div>
                <div className="text-lg sm:text-xl font-bold text-slate-400 mt-1">
                  {skippedItems.length}
                </div>
              </div>
            </div>

            {/* Total de intercorrências */}
            {(() => {
              const allIssues = [
                ...completedItems.flatMap((i) => i.issues),
                ...skippedItems.flatMap((i) => i.issues),
              ];
              if (allIssues.length === 0) return null;
              return (
                <div className="w-full p-3.5 rounded-2xl bg-amber-950/50 border border-amber-900/60 text-left text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    {allIssues.length} Intercorrência(s) registrada(s) durante o treino:
                  </div>
                  <div className="space-y-1">
                    {allIssues.map((iss, idx) => (
                      <div key={idx} className="text-amber-200/90 text-[11px] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <strong>{iss.label}</strong>
                        {iss.description && <span>— "{iss.description}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Percepção de Esforço (PSE 1 a 10) */}
            <div className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Percepção Subjetiva de Esforço (PSE do Aluno):
                </label>
                <span className="text-sm font-bold text-emerald-400">{perceivedEffort} / 10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={perceivedEffort}
                onChange={(e) => setPerceivedEffort(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 - Muito Fácil</span>
                <span>5 - Moderado</span>
                <span>8 - Difícil</span>
                <span>10 - Exaustão Máxima</span>
              </div>
            </div>

            {/* Observações Gerais do Personal */}
            <div className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 text-left space-y-2">
              <label className="text-xs font-bold text-slate-300">
                Observações do Personal sobre a Sessão (opcional):
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Aluno respondeu muito bem aos exercícios de peito, aumentamos a carga no supino. Queixou-se de fadiga ao final..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Botões de Ação na Finalização */}
            <div className="w-full flex items-center justify-between gap-3 pt-2">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsFinishing(false)}
                  className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  ← Voltar aos Exercícios
                </button>
              )}

              <button
                type="button"
                disabled={savingSession}
                onClick={handleSaveSession}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                {savingSession ? 'Salvando Atendimento...' : 'Salvar e Concluir Atendimento'}
              </button>
            </div>
          </div>
        ) : (
          /* MODO EXERCÍCIO DA VEZ */
          <>
            {/* CABEÇALHO DO EXERCÍCIO ATUAL */}
            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800/80 text-emerald-400">
                      Exercício #{processedCount + 1}
                    </span>
                    {currentItem.muscle_group_name && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {currentItem.muscle_group_name}
                      </span>
                    )}
                    {currentItem.category_name && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                        {currentItem.category_name}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {currentItem.exercise_name}
                  </h1>

                  {/* Detalhes do Esquema */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${schemeMeta.badgeCls}`}>
                      <Sparkles className="w-3 h-3" />
                      {schemeMeta.label}: {currentItem.sets}x {currentItem.reps}
                    </span>

                    {currentItem.weight && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-bold text-[11px]">
                        Alvo: {currentItem.weight} kg
                      </span>
                    )}

                    {currentItem.rest_time && currentItem.rest_time !== '0' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Descanso: {currentItem.rest_time}{currentItem.rest_unit === 'minutes' ? 'min' : 's'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão de Ver Demonstração se houver mídia */}
                {currentItem.media_url && (
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(true)}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Ver vídeo/demonstração do exercício"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Ver Vídeo</span>
                  </button>
                )}
              </div>

              {/* Observação do treino para este exercício */}
              {currentItem.notes && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 italic">
                  💡 Nota: "{currentItem.notes}"
                </div>
              )}

              {/* Intercorrências já registradas neste exercício */}
              {currentItem.issues.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Intercorrências anotadas neste exercício:
                  </div>
                  {currentItem.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-2 rounded-xl bg-amber-950/60 border border-amber-800/80 text-xs text-amber-200 flex items-center justify-between gap-2"
                    >
                      <div>
                        <strong>{iss.label}</strong>
                        {iss.description && <span className="opacity-90"> — {iss.description}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIssue(iss.id)}
                        className="text-amber-400 hover:text-white p-1"
                        title="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TABELA INTERATIVA DE SÉRIES E CARGAS */}
            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Séries e Cargas Reais
                </h3>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={removeLastSet}
                    disabled={currentItem.performedSets.length <= 1}
                    className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Remover série"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={addSet}
                    className="p-1 rounded-lg bg-slate-800 text-emerald-400 hover:text-white cursor-pointer"
                    title="Adicionar série extra"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Lista de Séries */}
              <div className="space-y-2">
                {currentItem.performedSets.map((s) => {
                  return (
                    <div
                      key={s.set_number}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                        s.completed
                          ? 'bg-emerald-950/40 border-emerald-600/60 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {/* Número da Série e Botão de Conclusão */}
                      <button
                        type="button"
                        onClick={() => toggleSetCompleted(s.set_number)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition cursor-pointer ${
                          s.completed
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={s.completed ? 'Desmarcar série' : 'Marcar série como feita'}
                      >
                        {s.completed ? <Check className="w-5 h-5 stroke-[3]" /> : s.set_number}
                      </button>

                      {/* Repetições */}
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <div className="space-y-0.5 flex-1">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block">
                            Reps
                          </label>
                          <input
                            type="text"
                            value={s.reps}
                            onChange={(e) => updateCurrentSet(s.set_number, 'reps', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-center text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Carga (kg) */}
                        <div className="space-y-0.5 flex-1">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block">
                            Carga (kg)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="0"
                              value={s.weight_kg || ''}
                              onChange={(e) =>
                                updateCurrentSet(s.set_number, 'weight_kg', e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-center text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Botão de Feito no final da linha */}
                      <button
                        type="button"
                        onClick={() => toggleSetCompleted(s.set_number)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition shrink-0 ${
                          s.completed
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white'
                        }`}
                      >
                        {s.completed ? 'Feita ✓' : 'Concluir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BOTÃO PARA REGISTRAR INTERCORRÊNCIA / SINTOMA FÍSICO */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(true)}
                className="w-full py-3 px-4 rounded-2xl bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/80 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <HeartPulse className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Registrar Intercorrência / Feedback Físico</span>
                <span className="text-[10px] text-amber-400/80 font-normal hidden sm:inline">
                  (Cansaço, batimentos, dor, tontura)
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* BARRA INFERIOR DE AÇÕES (BOTTOM BAR FIXA NO MOBILE) */}
      {currentItem && !isFinishing && (
        <footer className="shrink-0 bg-slate-900 border-t border-slate-800 p-3 sm:px-6 sm:py-3.5 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            {/* Botão: Pular Exercício (ir para o fim da fila) */}
            <button
              type="button"
              onClick={handleSkipExerciseToBack}
              className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Jogar este exercício para o final da fila e fazer depois"
            >
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Pular (Fim da fila)</span>
              <span className="sm:hidden">Pular</span>
            </button>

            {/* Botão: Marcar como Não Realizado */}
            <button
              type="button"
              onClick={() => setIsNotDoneModalOpen(true)}
              className="px-3 sm:px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/60 text-rose-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Marcar exercício como não realizado nesta sessão"
            >
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Não Realizado</span>
              <span className="sm:hidden">Não Feito</span>
            </button>

            {/* Botão Principal: Finalizar Exercício */}
            <button
              type="button"
              onClick={handleCompleteExercise}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer min-h-12"
            >
              <span>Concluir Exercício</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}

      {/* MODAL PARA REGISTRAR INTERCORRÊNCIA */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Registrar Intercorrência</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecione o sintoma ou sinal manifestado pelo aluno durante a execução de{' '}
              <strong className="text-slate-200">{currentItem?.exercise_name}</strong>:
            </p>

            {/* Grid de Opções Rápidas de 1 toque */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PHYSIOLOGICAL_ISSUE_OPTIONS.map((opt) => {
                const isSelected = selectedIssueType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedIssueType(opt.type)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer text-xs font-semibold ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>{opt.label}</div>
                  </button>
                );
              })}
            </div>

            {/* Campo de Descrição Detalhada / Medição Opcional */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-300">
                Observação adicional ou medição (opcional):
              </label>
              <textarea
                rows={2}
                placeholder={
                  PHYSIOLOGICAL_ISSUE_OPTIONS.find((o) => o.type === selectedIssueType)
                    ?.descriptionHint || 'Descreva detalhes...'
                }
                value={customIssueDesc}
                onChange={(e) => setCustomIssueDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {/* Botões do Modal */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveIssue}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Confirmar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA MARCAR EXERCÍCIO COMO NÃO REALIZADO */}
      {isNotDoneModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-base text-white">Não Realizado</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNotDoneModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Confirme que o exercício <strong className="text-white">"{currentItem?.exercise_name}"</strong> não será realizado nesta sessão.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Motivo (opcional):</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['Dor / Desconforto', 'Aparelho Ocupado', 'Tempo Esgotado', 'Limitação do Aluno', 'Substituído'].map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNotDoneReason(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                        notDoneReason === r
                          ? 'bg-rose-950 border-rose-500 text-rose-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  )
                )}
              </div>
              <input
                type="text"
                placeholder="Ou digite o motivo..."
                value={notDoneReason}
                onChange={(e) => setNotDoneReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNotDoneModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmNotDone}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Marcar Não Realizado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEMONSTRAÇÃO / VÍDEO DO EXERCÍCIO */}
      {showMediaModal && currentItem && currentItem.media_url && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-white truncate">
                Demonstração — {currentItem.exercise_name}
              </h3>
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                  title={currentItem.exercise_name}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : currentItem.media_type === 'video' ? (
                <video src={currentItem.media_url} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <img src={currentItem.media_url} alt="" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
