import { useState, useEffect, useRef, useId, useMemo, useCallback } from 'react';
import {
  X, Award, AlertTriangle, CheckCircle2, Calendar, FileText,
  TrendingUp, TrendingDown, Minus, Sparkles, UserCheck, Clock,
  XCircle, BookOpen, Mail, Plus, User, PackageCheck
} from 'lucide-react';
import { DataStore } from '../services/DataStore';
import { useSettings } from '../context/SettingsContext';

const PERIODS = ['1', '2', '3', '4'];
const PASS_GRADE = 3.0;

// Feature detection for discrete display transitions (Firefox bug 1882408 probe)
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return typeof window !== 'undefined' && window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

function getGradeColor(val) {
  if (val === null || val === undefined || isNaN(val)) return 'var(--color-text-secondary)';
  if (val < 3.0) return '#ff3b30';
  if (val < 4.0) return '#ff9f0a';
  if (val <= 4.5) return '#30d158';
  return '#28a745';
}

function getPerformanceMeta(avg, lang = 'es') {
  const isEs = lang !== 'en';
  if (avg === null || avg === undefined || isNaN(avg)) {
    return {
      level: 'none',
      badge: isEs ? 'Sin Calificaciones' : 'No Grades Yet',
      emoji: '📭',
      mascotClass: 'mascot-fair',
      color: 'var(--color-text-secondary)',
      borderColor: 'var(--color-border)',
      bgGradient: 'linear-gradient(135deg, rgba(134,134,139,0.12), rgba(134,134,139,0.04))',
      title: isEs ? '📋 Sin calificaciones registradas en este alcance' : '📋 No grades recorded in this scope yet',
      subtitle: isEs
        ? 'Aún no se han calificado actividades promediables. Revisa la asistencia y el observador a continuación.'
        : 'No averaged activities have been graded yet. Check attendance and observer notes below.'
    };
  }

  if (avg >= 4.5) {
    return {
      level: 'superior',
      badge: isEs ? '🏆 Desempeño Superior' : '🏆 Superior Performance',
      emoji: '🤩',
      mascotClass: 'mascot-excellent',
      color: '#28a745',
      borderColor: '#34c759',
      bgGradient: 'linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(48, 176, 199, 0.12))',
      title: isEs
        ? '🏆 ¡Felicitaciones por un Rendimiento Académico Superior!'
        : '🏆 Congratulations on Superior Academic Performance!',
      subtitle: isEs
        ? '¡Excelente trabajo! El estudiante demuestra un dominio sobresaliente, compromiso y dedicación ejemplar en el área. 🌟👏'
        : 'Outstanding work! The student demonstrates exceptional mastery, commitment, and dedication in the subject. 🌟👏'
    };
  }

  if (avg >= 4.0) {
    return {
      level: 'alto',
      badge: isEs ? '🌟 Desempeño Alto' : '🌟 High Performance',
      emoji: '😁',
      mascotClass: 'mascot-good',
      color: '#30d158',
      borderColor: '#30d158',
      bgGradient: 'linear-gradient(135deg, rgba(48, 209, 88, 0.16), rgba(52, 199, 89, 0.06))',
      title: isEs
        ? '🎉 ¡Felicitaciones por tu Buen Rendimiento Académico!'
        : '🎉 Congratulations on Your High Academic Performance!',
      subtitle: isEs
        ? '¡Muy buen desempeño! El estudiante mantiene un nivel alto y constante en las actividades del área. ✨👍'
        : 'Great job! The student maintains a high and consistent level across class activities. ✨👍'
    };
  }

  if (avg >= 3.0) {
    const nearRisk = avg < 3.4;
    return {
      level: 'basico',
      badge: isEs ? (nearRisk ? '⚠️ Básico (En Observación)' : '👍 Desempeño Básico') : (nearRisk ? '⚠️ Basic (Watch closely)' : '👍 Basic Performance'),
      emoji: nearRisk ? '😐' : '🙂',
      mascotClass: 'mascot-fair',
      color: '#ff9f0a',
      borderColor: '#ff9f0a',
      bgGradient: 'linear-gradient(135deg, rgba(255, 159, 10, 0.18), rgba(255, 159, 10, 0.05))',
      title: nearRisk
        ? (isEs ? '⚠️ Atención Preventiva: Promedio Básico Cercano al Límite' : '⚠️ Preventive Alert: Basic Average Near Minimum Threshold')
        : (isEs ? '💪 Desempeño Básico — En Aprobación con Potencial de Mejora' : '💪 Basic Performance — Passing with Room to Grow'),
      subtitle: nearRisk
        ? (isEs
            ? 'El estudiante aprueba actualmente, pero su promedio está muy cerca de 3.0. ¡Es importante reforzar las próximas entregas para no caer en riesgo!'
            : 'The student is currently passing, but the average is very close to 3.0. Reinforce upcoming activities to avoid falling at risk!')
        : (isEs
            ? 'El estudiante cumple con los objetivos básicos del área. Con un poco más de esfuerzo en las actividades puede alcanzar un nivel Alto o Superior. 📈'
            : 'The student meets the basic objectives. With a bit more effort on activities, they can reach High or Superior performance. 📈')
    };
  }

  return {
    level: 'bajo',
    badge: isEs ? '🚨 Bajo Rendimiento (< 3.0)' : '🚨 Low Performance (< 3.0)',
    emoji: avg < 2.0 ? '😡' : '😢',
    mascotClass: avg < 2.0 ? 'mascot-fail' : 'mascot-poor',
    color: '#ff3b30',
    borderColor: '#ff3b30',
    bgGradient: 'linear-gradient(135deg, rgba(255, 59, 48, 0.22), rgba(255, 159, 10, 0.08))',
    title: isEs
      ? '🚨 ALERTA DE BAJO RENDIMIENTO ACADÉMICO'
      : '🚨 LOW ACADEMIC PERFORMANCE ALERT',
    subtitle: isEs
      ? `Atención prioritaria: El promedio actual (${avg.toFixed(1)}) se encuentra por debajo de la nota mínima de aprobación (3.0). Se requiere revisar actividades pendientes o reprobadas y acompañamiento en casa.`
      : `Priority attention: Current average (${avg.toFixed(1)}) is below the minimum passing grade (3.0). Please review missing or failed activities and support at home.`
  };
}

function parseAnnotation(obsString) {
  const match = String(obsString).match(/^\[(.*?)]\s*(.*)$/);
  const date = match ? match[1] : '';
  const note = match ? match[2] : String(obsString);

  const lower = note.toLowerCase();
  let category = 'convivencia'; // default teacher note
  let icon = '📋';
  let color = 'var(--color-accent)';

  if (lower.includes('falla a clase') || lower.includes('inasistencia')) {
    category = 'attendance';
    icon = '❌';
    color = 'var(--color-danger)';
  } else if (lower.includes('llegada tarde') || lower.includes('retardo')) {
    category = 'attendance';
    icon = '⏰';
    color = 'var(--color-warning)';
  } else if (lower.includes('pendiente de correo') || lower.includes('número telefónico')) {
    category = 'contact';
    icon = '📞';
    color = 'var(--color-text-secondary)';
  } else if (
    lower.includes('felicit') ||
    lower.includes('excelente') ||
    lower.includes('destacad') ||
    lower.includes('buen trabajo') ||
    lower.includes('participa')
  ) {
    category = 'positive';
    icon = '🌟';
    color = 'var(--color-success)';
  } else {
    category = 'convivencia';
    icon = '⚠️';
    color = '#ff9f0a';
  }

  return { date, note, category, icon, color, raw: obsString };
}

export function StudentSummaryModal({
  student,
  courseId,
  allCourseStudents = [],
  lateTimes = {},
  onClose,
  onOpenProfile,
  onAddObservation,
  onSendObservationEmail
}) {
  const { settings, updateSettings, t } = useSettings();
  const lang = settings?.language || 'es';
  const isEs = lang !== 'en';
  const activePeriod = settings?.currentPeriod || '1';

  // Scope mode: 'single' | 'all' — initialized from user configuration in Settings
  const [scopeMode, setScopeMode] = useState(() => settings?.studentReportMode || 'single');
  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod);

  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const bannerRef = useRef(null);
  const mascotRef = useRef(null);
  const animFrameRef = useRef(null);
  const titleId = useId();

  // Keep local scopeMode synced if settings.studentReportMode changes externally
  useEffect(() => {
    if (settings?.studentReportMode) {
      setScopeMode(settings.studentReportMode);
    }
  }, [settings?.studentReportMode]);

  const handleScopeChange = (newMode, periodOverride = null) => {
    setScopeMode(newMode);
    if (periodOverride) setSelectedPeriod(periodOverride);
    updateSettings({ studentReportMode: newMode });
  };

  // Smooth top-layer close helper with fallback for browsers lacking discrete display/overlay transitions
  const handleRequestClose = useCallback(async () => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open) {
      onClose?.();
      return;
    }

    if (!supportsTopLayerExit()) {
      dialog.setAttribute('data-closing', '');
      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 400))
        ]);
      }
      if (!dialog.hasAttribute('data-closing')) return;
      dialog.removeAttribute('data-closing');
    }

    dialog.close();
  }, [onClose]);

  // Open <dialog> as modal and attach light-dismiss / cancel fallbacks
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const handleCancel = (event) => {
      event.preventDefault();
      handleRequestClose();
    };

    const handleClose = () => {
      onClose?.();
    };

    // Fallback for browsers without <dialog closedby="any"> support (e.g. Safari)
    const handleBackdropClick = (event) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        handleRequestClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [handleRequestClose, onClose]);

  // Compute data across all 4 periods so both 'single' and 'all' modes are instantaneous
  const reportData = useMemo(() => {
    if (!student) return null;

    const perPeriod = {};
    PERIODS.forEach((p) => {
      const activities = DataStore.getActivities(courseId, p) || [];
      const materials = DataStore.getMaterials(courseId, p) || [];
      const promediable = activities.filter((a) => a.isAveraged !== false);
      const studentGrades = student.grades?.[p] || {};

      let sum = 0;
      let gradedCount = 0;
      let failedCount = 0;
      let missingCount = 0;

      const activityItems = activities.map((act) => {
        const raw = studentGrades[act.id];
        const num = raw !== undefined && raw !== null && raw !== '' ? parseFloat(raw) : null;
        const isGraded = num !== null && !isNaN(num);
        if (act.isAveraged !== false) {
          if (isGraded) {
            sum += num;
            gradedCount++;
            if (num < PASS_GRADE) failedCount++;
          } else {
            missingCount++;
          }
        }
        const attOnDate = act.date ? student.attendance?.[p]?.[act.date] : undefined;
        return {
          ...act,
          period: p,
          rawGrade: raw ?? '',
          numGrade: isGraded ? num : null,
          isGraded,
          attOnDate
        };
      });

      const avg = gradedCount > 0 ? sum / gradedCount : null;
      // Average if empty cells count as 1.0 (projected risk metric)
      const projectedSum = sum + missingCount * 1.0;
      const projectedAvg = promediable.length > 0 ? projectedSum / promediable.length : null;

      // Course average in this period for comparison
      const courseStudentAvgs = [];
      allCourseStudents.forEach((s) => {
        let sSum = 0;
        let sCount = 0;
        promediable.forEach((a) => {
          const v = parseFloat((s.grades?.[p] || {})[a.id]);
          if (!isNaN(v)) {
            sSum += v;
            sCount++;
          }
        });
        if (sCount > 0) courseStudentAvgs.push({ id: s.id, avg: sSum / sCount });
      });

      const courseAvg =
        courseStudentAvgs.length > 0
          ? courseStudentAvgs.reduce((acc, x) => acc + x.avg, 0) / courseStudentAvgs.length
          : null;

      const sortedRank = [...courseStudentAvgs].sort((a, b) => b.avg - a.avg);
      const rankIndex = sortedRank.findIndex((x) => x.id === student.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : null;

      // Attendance for period p
      const allDates = Array.from(
        new Set(allCourseStudents.flatMap((s) => Object.keys(s.attendance?.[p] || {})))
      ).sort();
      const studentAtt = student.attendance?.[p] || {};
      const attRecords = allDates.map((date) => {
        const status = studentAtt[date]; // 'present' | 'absent' | 'late' | undefined
        const lateTime = status === 'late' ? lateTimes[`${student.id}_${date}`] : null;
        return { date, period: p, status, lateTime };
      });

      const presentCount = attRecords.filter((r) => r.status === 'present').length;
      const absentCount = attRecords.filter((r) => r.status === 'absent').length;
      const lateCount = attRecords.filter((r) => r.status === 'late').length;
      const totalMarkedAtt = presentCount + absentCount + lateCount;
      const attendanceRate =
        totalMarkedAtt > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalMarkedAtt) * 100) : null;

      // Annotations / Observer for period p
      const rawNotes = student.annotations?.[p] || [];
      const parsedNotes = rawNotes.map((n, idx) => ({
        ...parseAnnotation(n),
        period: p,
        index: idx
      }));

      // Materials for period p
      const studentMats = student.materials?.[p] || {};
      const materialItems = materials.map((m) => ({
        ...m,
        period: p,
        value: studentMats[m.id] || ''
      }));

      perPeriod[p] = {
        period: p,
        activities,
        promediableCount: promediable.length,
        gradedCount,
        failedCount,
        missingCount,
        compliancePct: promediable.length > 0 ? Math.round((gradedCount / promediable.length) * 100) : null,
        avg,
        projectedAvg,
        courseAvg,
        rank,
        rankedTotal: courseStudentAvgs.length,
        coevaluation: student.coevaluation?.[p] || '',
        autoevaluation: student.autoevaluation?.[p] || '',
        activityItems,
        attRecords,
        presentCount,
        absentCount,
        lateCount,
        totalMarkedAtt,
        attendanceRate,
        parsedNotes,
        materialItems
      };
    });

    // Aggregate for current scope ('single' vs 'all')
    const targetPeriods = scopeMode === 'all' ? PERIODS : [selectedPeriod];
    const activePeriodObjs = targetPeriods.map((p) => perPeriod[p]);

    const periodsWithGrades = activePeriodObjs.filter((pObj) => pObj.avg !== null);
    const overallAvg =
      periodsWithGrades.length > 0
        ? periodsWithGrades.reduce((acc, pObj) => acc + pObj.avg, 0) / periodsWithGrades.length
        : null;

    const periodsWithCourseAvg = activePeriodObjs.filter((pObj) => pObj.courseAvg !== null);
    const overallCourseAvg =
      periodsWithCourseAvg.length > 0
        ? periodsWithCourseAvg.reduce((acc, pObj) => acc + pObj.courseAvg, 0) / periodsWithCourseAvg.length
        : null;

    const totalPromediable = activePeriodObjs.reduce((acc, pObj) => acc + pObj.promediableCount, 0);
    const totalGraded = activePeriodObjs.reduce((acc, pObj) => acc + pObj.gradedCount, 0);
    const totalFailed = activePeriodObjs.reduce((acc, pObj) => acc + pObj.failedCount, 0);
    const totalMissing = activePeriodObjs.reduce((acc, pObj) => acc + pObj.missingCount, 0);
    const overallCompliance = totalPromediable > 0 ? Math.round((totalGraded / totalPromediable) * 100) : null;

    const totalPresent = activePeriodObjs.reduce((acc, pObj) => acc + pObj.presentCount, 0);
    const totalAbsent = activePeriodObjs.reduce((acc, pObj) => acc + pObj.absentCount, 0);
    const totalLate = activePeriodObjs.reduce((acc, pObj) => acc + pObj.lateCount, 0);
    const totalMarkedAtt = totalPresent + totalAbsent + totalLate;
    const overallAttRate =
      totalMarkedAtt > 0 ? Math.round(((totalPresent + totalLate * 0.5) / totalMarkedAtt) * 100) : null;

    const allActivityItems = activePeriodObjs.flatMap((pObj) => pObj.activityItems);
    const allAttRecords = activePeriodObjs.flatMap((pObj) => pObj.attRecords);
    const allNotes = activePeriodObjs.flatMap((pObj) => pObj.parsedNotes);
    const allMaterials = activePeriodObjs.flatMap((pObj) => pObj.materialItems);

    // Trend across periods that have grades
    const allGradedPeriods = PERIODS.map((p) => perPeriod[p]).filter((pObj) => pObj.avg !== null);
    let trend = 'stable';
    let trendDelta = 0;
    if (allGradedPeriods.length >= 2) {
      const first = allGradedPeriods[0].avg;
      const last = allGradedPeriods[allGradedPeriods.length - 1].avg;
      trendDelta = last - first;
      if (trendDelta >= 0.2) trend = 'up';
      else if (trendDelta <= -0.2) trend = 'down';
    }

    return {
      perPeriod,
      overallAvg,
      overallCourseAvg,
      totalPromediable,
      totalGraded,
      totalFailed,
      totalMissing,
      overallCompliance,
      totalPresent,
      totalAbsent,
      totalLate,
      totalMarkedAtt,
      overallAttRate,
      allActivityItems,
      allAttRecords,
      allNotes,
      allMaterials,
      trend,
      trendDelta,
      singlePeriodData: perPeriod[selectedPeriod]
    };
  }, [student, courseId, allCourseStudents, lateTimes, scopeMode, selectedPeriod]);

  const perfMeta = useMemo(
    () => getPerformanceMeta(reportData?.overallAvg ?? null, lang),
    [reportData?.overallAvg, lang]
  );

  // Canvas Particle & Web Animations API Engine (Confetti / Stars for good performance, Warning Pulse for low)
  const triggerVisualEffect = useCallback(
    (mode = perfMeta.level) => {
      if (typeof window === 'undefined') return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      // 1. Web Animations API on mascot & banner
      if (mascotRef.current) {
        if (mode === 'superior' || mode === 'alto') {
          mascotRef.current.animate(
            [
              { transform: 'scale(0.7) rotate(-12deg)' },
              { transform: 'scale(1.22) rotate(10deg)' },
              { transform: 'scale(0.95) rotate(-5deg)' },
              { transform: 'scale(1.08) rotate(3deg)' },
              { transform: 'scale(1) rotate(0deg)' }
            ],
            { duration: 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          );
        } else if (mode === 'bajo') {
          mascotRef.current.animate(
            [
              { transform: 'translateX(0) scale(1)' },
              { transform: 'translateX(-7px) scale(1.1)' },
              { transform: 'translateX(7px) scale(1.1)' },
              { transform: 'translateX(-5px) scale(1.05)' },
              { transform: 'translateX(5px) scale(1.05)' },
              { transform: 'translateX(0) scale(1)' }
            ],
            { duration: 550, easing: 'ease-in-out' }
          );
        }
      }

      // 2. Canvas 2D Particle System
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      const rect = canvas.parentElement?.getBoundingClientRect() || { width: 800, height: 600 };
      canvas.width = rect.width;
      canvas.height = rect.height;

      const particles = [];

      if (mode === 'superior' || mode === 'alto') {
        const count = mode === 'superior' ? 85 : 50;
        const palette = ['#34c759', '#ffd60a', '#00f0ff', '#ff2d55', '#5e5ce6', '#ff9f0a', '#30d158'];
        const emojis = mode === 'superior' ? ['🏆', '🌟', '🎉', '✨', '👏'] : ['🎉', '✨', '⭐', '👏'];

        for (let i = 0; i < count; i++) {
          const isEmoji = i < 10;
          particles.push({
            x: canvas.width * (0.2 + Math.random() * 0.6),
            y: 60 + Math.random() * 40,
            vx: (Math.random() - 0.5) * 11,
            vy: -Math.random() * 9 - 3,
            gravity: 0.22 + Math.random() * 0.08,
            size: isEmoji ? 20 + Math.random() * 8 : 6 + Math.random() * 6,
            color: palette[i % palette.length],
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.2,
            alpha: 1,
            decay: 0.008 + Math.random() * 0.007,
            isEmoji,
            emoji: emojis[i % emojis.length]
          });
        }
      } else if (mode === 'bajo') {
        // Subtle warning embers around top banner
        for (let i = 0; i < 28; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: 40 + Math.random() * 110,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -0.6 - Math.random() * 1.2,
            gravity: -0.01,
            size: 3 + Math.random() * 4,
            color: i % 2 === 0 ? '#ff3b30' : '#ff9f0a',
            rotation: 0,
            vr: 0,
            alpha: 0.85,
            decay: 0.014 + Math.random() * 0.01,
            isCircle: true
          });
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach((p) => {
          if (p.alpha <= 0) return;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.99;
          p.rotation += p.vr;
          p.alpha -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);

          if (p.isEmoji) {
            ctx.font = `${Math.round(p.size)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.emoji, 0, 0);
          } else if (p.isCircle) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          }
          ctx.restore();
        });

        if (alive) {
          animFrameRef.current = requestAnimationFrame(render);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      animFrameRef.current = requestAnimationFrame(render);
    },
    [perfMeta.level]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerVisualEffect(perfMeta.level);
    }, 120);
    return () => {
      clearTimeout(timer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [perfMeta.level, scopeMode, selectedPeriod, triggerVisualEffect]);

  if (!student || !reportData) return null;

  // Diagnostic chips for quick parent/teacher/student reading
  const diagnosticChips = [];
  if (reportData.overallAvg !== null) {
    if (reportData.overallAvg < PASS_GRADE) {
      const needed = (PASS_GRADE - reportData.overallAvg).toFixed(1);
      diagnosticChips.push({
        type: 'danger',
        text: isEs ? `🚨 Faltan +${needed} décimas para llegar a 3.0` : `🚨 Needs +${needed} pts to reach 3.0`
      });
    } else if (reportData.overallAvg >= 4.5) {
      diagnosticChips.push({
        type: 'success',
        text: isEs ? '🏆 Excelencia Académica (>= 4.5)' : '🏆 Academic Excellence (>= 4.5)'
      });
    } else if (reportData.overallAvg >= 4.0) {
      diagnosticChips.push({
        type: 'success',
        text: isEs ? '🌟 Nivel Alto Destacado' : '🌟 High Standing'
      });
    }
  }

  if (reportData.totalMissing > 0) {
    diagnosticChips.push({
      type: 'warning',
      text: isEs
        ? `📭 ${reportData.totalMissing} actividad(es) pendiente(s) de entrega`
        : `📭 ${reportData.totalMissing} missing activity(ies)`
    });
  } else if (reportData.totalPromediable > 0) {
    diagnosticChips.push({
      type: 'success',
      text: isEs ? '✅ 100% de actividades entregadas' : '✅ 100% activities submitted'
    });
  }

  if (reportData.totalFailed > 0) {
    diagnosticChips.push({
      type: 'danger',
      text: isEs
        ? `📉 ${reportData.totalFailed} actividad(es) con nota baja (< 3.0)`
        : `📉 ${reportData.totalFailed} failed activity(ies) (< 3.0)`
    });
  }

  if (reportData.totalAbsent >= 3) {
    diagnosticChips.push({
      type: 'danger',
      text: isEs
        ? `🚨 Alerta por ${reportData.totalAbsent} fallas de asistencia`
        : `🚨 Alert: ${reportData.totalAbsent} class absences`
    });
  } else if (reportData.totalAbsent > 0) {
    diagnosticChips.push({
      type: 'warning',
      text: isEs ? `❌ ${reportData.totalAbsent} falla(s) registrada(s)` : `❌ ${reportData.totalAbsent} absence(s)`
    });
  } else if (reportData.totalPresent > 0 && reportData.totalLate === 0) {
    diagnosticChips.push({
      type: 'success',
      text: isEs ? '🏅 ¡Asistencia y puntualidad perfecta!' : '🏅 Perfect attendance & punctuality!'
    });
  }

  if (reportData.totalLate >= 2) {
    diagnosticChips.push({
      type: 'warning',
      text: isEs ? `⏰ ${reportData.totalLate} llegadas tarde a clase` : `⏰ ${reportData.totalLate} late arrivals`
    });
  }

  const convivenciaNotes = reportData.allNotes.filter((n) => n.category === 'convivencia');
  const positiveNotes = reportData.allNotes.filter((n) => n.category === 'positive');
  const contactNotes = reportData.allNotes.filter((n) => n.category === 'contact');

  if (convivenciaNotes.length > 0) {
    diagnosticChips.push({
      type: 'warning',
      text: isEs
        ? `📋 ${convivenciaNotes.length} observación(es) de seguimiento`
        : `📋 ${convivenciaNotes.length} follow-up observation(s)`
    });
  } else {
    diagnosticChips.push({
      type: 'success',
      text: isEs ? '🕊️ Sin reportes negativos de convivencia' : '🕊️ No negative behavioral notes'
    });
  }

  // SVG Circular Gauge math for Academic Average (radius = 48, circumference = 2 * pi * 48 ≈ 301.59)
  const gaugeRadius = 48;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const avgVal = reportData.overallAvg;
  const avgPct = avgVal !== null ? Math.max(0, Math.min(avgVal / 5.0, 1)) : 0;
  const gaugeOffset = gaugeCircumference * (1 - avgPct);

  // SVG Attendance Donut math (radius = 44, circumference ≈ 276.46)
  const attRadius = 44;
  const attCircumference = 2 * Math.PI * attRadius;
  const pFraction = reportData.totalMarkedAtt > 0 ? reportData.totalPresent / reportData.totalMarkedAtt : 0;
  const lFraction = reportData.totalMarkedAtt > 0 ? reportData.totalLate / reportData.totalMarkedAtt : 0;
  const aFraction = reportData.totalMarkedAtt > 0 ? reportData.totalAbsent / reportData.totalMarkedAtt : 0;

  const pLen = pFraction * attCircumference;
  const lLen = lFraction * attCircumference;
  const aLen = aFraction * attCircumference;

  return (
    <dialog
      ref={dialogRef}
      className="student-summary-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' })}
    >
      <div className="student-summary-scroll">
        {/* Celebration / Alert Particle Canvas */}
        <canvas ref={canvasRef} className="student-summary-canvas" aria-hidden="true" />

        {/* Header: Student Identity + Configurable Period Scope */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
                flexShrink: 0,
                boxShadow: 'var(--shadow-sm)'
              }}
              aria-hidden="true"
            >
              {(student.name || 'E')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(0, 113, 227, 0.12)',
                    color: 'var(--color-accent)'
                  }}
                >
                  {courseId}
                </span>
                {student.vpsCode && student.vpsCode !== 'Pending' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    VPS: {student.vpsCode}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  • {settings?.subject || 'Música'} ({settings?.teacherName || 'Docente'})
                </span>
              </div>
              <h1 id={titleId} style={{ fontSize: '1.55rem', margin: '0.15rem 0 0', lineHeight: 1.2 }}>
                {student.name}
              </h1>
            </div>
          </div>

          {/* Right Controls: Period Configuration Bar + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Period / All-Periods Switcher */}
            <div
              role="group"
              aria-label={t('studentReportSettingLabel')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--color-bg-body)',
                padding: '4px',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                gap: '3px'
              }}
            >
              {PERIODS.map((p) => {
                const isSelected = scopeMode === 'single' && selectedPeriod === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleScopeChange('single', p)}
                    style={{
                      border: 'none',
                      background: isSelected ? 'var(--color-accent)' : 'transparent',
                      color: isSelected ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={`${t('period')} ${p}`}
                  >
                    P{p}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleScopeChange('all')}
                style={{
                  border: 'none',
                  background: scopeMode === 'all' ? 'var(--color-accent)' : 'transparent',
                  color: scopeMode === 'all' ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                📊 {t('studentReportAll')}
              </button>
            </div>

            {onOpenProfile && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onOpenProfile(student)}
                style={{ padding: '0.42rem 0.75rem', fontSize: '0.82rem', gap: '5px' }}
              >
                <User size={15} aria-hidden="true" />
                {t('studentReportViewProfile')}
              </button>
            )}

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label={t('studentReportClose')}
              style={{
                background: 'var(--color-bg-body)',
                border: '1px solid var(--color-border)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-primary)'
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Hero Status Banner (Alert or Congratulations) */}
        <section
          ref={bannerRef}
          className={`ssm-banner ${
            perfMeta.level === 'bajo'
              ? 'ssm-banner-alert-pulse'
              : perfMeta.level === 'superior' || perfMeta.level === 'alto'
              ? 'ssm-banner-celebrate-glow'
              : ''
          }`}
          style={{
            '--ssm-banner-border': perfMeta.borderColor,
            '--ssm-banner-bg': perfMeta.bgGradient
          }}
        >
          <div ref={mascotRef} className={`ssm-mascot-bubble ${perfMeta.mascotClass}`} aria-hidden="true">
            {perfMeta.emoji}
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  background: perfMeta.color,
                  color: '#fff',
                  letterSpacing: '0.4px'
                }}
              >
                {perfMeta.badge}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {scopeMode === 'all'
                  ? isEs
                    ? 'Consolidado Períodos 1 al 4'
                    : 'Consolidated Periods 1 to 4'
                  : `${t('period')} ${selectedPeriod}`}
              </span>
            </div>

            <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.25rem', color: 'var(--color-text-primary)' }}>
              {perfMeta.title}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              {perfMeta.subtitle}
            </p>

            {/* Quick Diagnostic Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.75rem' }}>
              {diagnosticChips.map((chip, idx) => {
                const bgMap = {
                  success: 'rgba(52, 199, 89, 0.15)',
                  warning: 'rgba(255, 159, 10, 0.16)',
                  danger: 'rgba(255, 59, 48, 0.16)'
                };
                const colorMap = {
                  success: '#248a3d',
                  warning: '#c93400',
                  danger: '#d70015'
                };
                return (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      background: bgMap[chip.type] || 'var(--color-bg-card)',
                      color:
                        document.documentElement.getAttribute('data-theme') === 'light'
                          ? colorMap[chip.type]
                          : 'var(--color-text-primary)',
                      border: `1px solid ${
                        chip.type === 'danger'
                          ? 'rgba(255,59,48,0.4)'
                          : chip.type === 'warning'
                          ? 'rgba(255,159,10,0.4)'
                          : 'rgba(52,199,89,0.4)'
                      }`
                    }}
                  >
                    {chip.text}
                  </span>
                );
              })}
            </div>
          </div>

          {(perfMeta.level === 'superior' || perfMeta.level === 'alto') && (
            <button
              type="button"
              className="btn"
              onClick={() => triggerVisualEffect(perfMeta.level)}
              style={{
                background: 'linear-gradient(135deg, #34c759, #30b0c7)',
                color: '#fff',
                fontWeight: 700,
                padding: '0.55rem 1rem',
                borderRadius: '999px',
                gap: '6px',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(52, 199, 89, 0.35)'
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              🎉 {t('studentReportCelebrate')}
            </button>
          )}
        </section>

        {/* 3 Graphical KPI Summary Cards: Academic, Attendance, Convivencia */}
        <section className="ssm-kpi-grid" aria-label={t('studentReportTitle')}>
          {/* CARD 1: RENDIMIENTO ACADÉMICO */}
          <div className="ssm-subcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📊 {t('studentReportAcademic')}
              </h3>
              {reportData.singlePeriodData?.rank && scopeMode === 'single' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  #{reportData.singlePeriodData.rank}/{reportData.singlePeriodData.rankedTotal}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Circular SVG Gauge */}
              <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
                <svg
                  width="112"
                  height="112"
                  viewBox="0 0 112 112"
                  role="img"
                  aria-label={`${t('studentReportAcademic')}: ${
                    avgVal !== null ? avgVal.toFixed(1) : isEs ? 'Sin nota' : 'No grade'
                  }`}
                >
                  <circle
                    cx="56"
                    cy="56"
                    r={gaugeRadius}
                    fill="none"
                    stroke="rgba(134, 134, 139, 0.2)"
                    strokeWidth="10"
                  />
                  {/* 3.0 Passing threshold tick on the ring (60% of 360deg = 216deg from top) */}
                  <circle
                    cx="56"
                    cy="56"
                    r={gaugeRadius}
                    fill="none"
                    stroke={getGradeColor(avgVal)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                    transform="rotate(-90 56 56)"
                    style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease' }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: getGradeColor(avgVal),
                      lineHeight: 1
                    }}
                  >
                    {avgVal !== null ? avgVal.toFixed(1) : '-'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    / 5.0
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {/* Comparison with course average */}
                <div
                  style={{
                    background: 'var(--color-bg-card)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}>
                    {isEs ? 'Promedio del curso' : 'Course average'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{reportData.overallCourseAvg !== null ? reportData.overallCourseAvg.toFixed(1) : '-'}</span>
                    {avgVal !== null && reportData.overallCourseAvg !== null && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color:
                            avgVal >= reportData.overallCourseAvg ? 'var(--color-success)' : 'var(--color-danger)'
                        }}
                      >
                        {avgVal >= reportData.overallCourseAvg ? '⬆️ +' : '⬇️ '}
                        {(avgVal - reportData.overallCourseAvg).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Co-evaluación & Auto-evaluación */}
                {scopeMode === 'single' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div
                      style={{
                        background: 'var(--color-bg-card)',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>Co-eval</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {reportData.singlePeriodData?.coevaluation || '-'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--color-bg-card)',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>Auto-eval</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {reportData.singlePeriodData?.autoevaluation || '-'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Delivery Compliance Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {isEs ? 'Actividades entregadas' : 'Submitted activities'}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {reportData.totalGraded} / {reportData.totalPromediable}{' '}
                  {reportData.overallCompliance !== null ? `(${reportData.overallCompliance}%)` : ''}
                </span>
              </div>
              <div
                className="ssm-progress-track"
                style={{
                  '--bar-pct': `${reportData.overallCompliance ?? 0}%`,
                  '--bar-color':
                    (reportData.overallCompliance ?? 100) < 70 ? 'var(--color-danger)' : 'var(--color-success)'
                }}
              >
                <div className="ssm-progress-fill" />
              </div>
            </div>
          </div>

          {/* CARD 2: ASISTENCIA Y PUNTUALIDAD */}
          <div className="ssm-subcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📅 {t('studentReportAttendance')}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {reportData.totalMarkedAtt} {isEs ? 'clases' : 'classes'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Multi-segment SVG Donut */}
              <div style={{ position: 'relative', width: '104px', height: '104px', flexShrink: 0 }}>
                <svg
                  width="104"
                  height="104"
                  viewBox="0 0 104 104"
                  role="img"
                  aria-label={`${t('studentReportAttendance')}: ${
                    reportData.overallAttRate !== null ? `${reportData.overallAttRate}%` : '-'
                  }`}
                >
                  <circle
                    cx="52"
                    cy="52"
                    r={attRadius}
                    fill="none"
                    stroke="rgba(134, 134, 139, 0.2)"
                    strokeWidth="10"
                  />
                  {reportData.totalMarkedAtt > 0 && (
                    <>
                      {/* Present segment */}
                      <circle
                        cx="52"
                        cy="52"
                        r={attRadius}
                        fill="none"
                        stroke="#34c759"
                        strokeWidth="10"
                        strokeDasharray={`${pLen} ${attCircumference - pLen}`}
                        strokeDashoffset={0}
                        transform="rotate(-90 52 52)"
                      />
                      {/* Late segment */}
                      <circle
                        cx="52"
                        cy="52"
                        r={attRadius}
                        fill="none"
                        stroke="#ff9f0a"
                        strokeWidth="10"
                        strokeDasharray={`${lLen} ${attCircumference - lLen}`}
                        strokeDashoffset={-pLen}
                        transform="rotate(-90 52 52)"
                      />
                      {/* Absent segment */}
                      <circle
                        cx="52"
                        cy="52"
                        r={attRadius}
                        fill="none"
                        stroke="#ff3b30"
                        strokeWidth="10"
                        strokeDasharray={`${aLen} ${attCircumference - aLen}`}
                        strokeDashoffset={-(pLen + lLen)}
                        transform="rotate(-90 52 52)"
                      />
                    </>
                  )}
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1 }}>
                    {reportData.overallAttRate !== null ? `${reportData.overallAttRate}%` : '-'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {isEs ? 'Asistencia' : 'Attendance'}
                  </span>
                </div>
              </div>

              {/* 3 Visual Attendance Counters */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-bg-card)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--color-success)'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>✅ {t('present')}</span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '0.95rem' }}>
                    {reportData.totalPresent}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-bg-card)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--color-danger)'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>❌ {t('absent')}</span>
                  <strong style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                    {reportData.totalAbsent}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-bg-card)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--color-warning)'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>⏰ {t('late')}</span>
                  <strong style={{ color: 'var(--color-warning)', fontSize: '0.95rem' }}>
                    {reportData.totalLate}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {reportData.totalMarkedAtt === 0
                ? isEs
                  ? '📭 Sin registros de asistencia tomados aún.'
                  : '📭 No attendance records taken yet.'
                : reportData.totalAbsent === 0 && reportData.totalLate === 0
                ? isEs
                  ? '🏅 ¡Felicitaciones! Asistencia y puntualidad impecables.'
                  : '🏅 Congratulations! Flawless attendance and punctuality.'
                : reportData.totalAbsent >= 3
                ? isEs
                  ? '🚨 Atención: Las inasistencias reiteradas afectan el aprendizaje.'
                  : '🚨 Warning: Repeated absences impact learning progress.'
                : isEs
                ? '👍 Asistencia dentro del rango esperado.'
                : '👍 Attendance within expected range.'}
            </div>
          </div>

          {/* CARD 3: OBSERVADOR, CONVIVENCIA Y MATERIALES */}
          <div className="ssm-subcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📝 {t('studentReportConvivencia')}
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background:
                    convivenciaNotes.length === 0
                      ? 'rgba(52, 199, 89, 0.16)'
                      : convivenciaNotes.length >= 3
                      ? 'rgba(255, 59, 48, 0.16)'
                      : 'rgba(255, 159, 10, 0.16)',
                  color:
                    convivenciaNotes.length === 0
                      ? 'var(--color-success)'
                      : convivenciaNotes.length >= 3
                      ? 'var(--color-danger)'
                      : 'var(--color-warning)'
                }}
              >
                {convivenciaNotes.length === 0
                  ? isEs
                    ? '🌟 Ejemplar'
                    : '🌟 Exemplary'
                  : convivenciaNotes.length >= 3
                  ? isEs
                    ? '🚨 Atención'
                    : '🚨 Priority'
                  : isEs
                  ? '👀 Seguimiento'
                  : '👀 Follow-up'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {convivenciaNotes.length + positiveNotes.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {isEs ? 'Notas Convivencia / Acad.' : 'Academic / Behavior Notes'}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-card)',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {reportData.allNotes.filter((n) => n.category === 'attendance').length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {isEs ? 'Reportes Asistencia' : 'Attendance Reports'}
                </div>
              </div>
            </div>

            {/* Materials summary if any exist */}
            {reportData.allMaterials.length > 0 ? (
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  padding: '0.5rem 0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <PackageCheck size={14} color="var(--color-accent)" aria-hidden="true" />
                  {t('studentReportMaterials')}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {reportData.allMaterials.map((m) => (
                    <span
                      key={`${m.period}-${m.id}`}
                      style={{
                        fontSize: '0.73rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: m.value ? 'rgba(52, 199, 89, 0.14)' : 'rgba(134, 134, 139, 0.15)',
                        fontWeight: 600
                      }}
                    >
                      {scopeMode === 'all' ? `[P${m.period}] ` : ''}
                      {m.name}: {m.value || (isEs ? 'Sin asignar' : 'Unassigned')}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 'auto' }}>
                {contactNotes.length > 0
                  ? `📞 ${contactNotes[0].note}`
                  : student.genericObs
                  ? `📌 ${student.genericObs}`
                  : isEs
                  ? '🕊️ Estudiante con buen trato y sana convivencia en el aula.'
                  : '🕊️ Positive classroom behavior and coexistence.'}
              </div>
            )}
          </div>
        </section>

        {/* PERIOD EVOLUTION CHART (Always shown when 'all' periods is selected, or collapsible comparison) */}
        {scopeMode === 'all' && (
          <section className="ssm-subcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📈 {t('studentReportEvolution')} (P1 – P4)
              </h3>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background:
                    reportData.trend === 'up'
                      ? 'rgba(52, 199, 89, 0.16)'
                      : reportData.trend === 'down'
                      ? 'rgba(255, 59, 48, 0.16)'
                      : 'rgba(134, 134, 139, 0.16)',
                  color:
                    reportData.trend === 'up'
                      ? 'var(--color-success)'
                      : reportData.trend === 'down'
                      ? 'var(--color-danger)'
                      : 'var(--color-text-secondary)'
                }}
              >
                {reportData.trend === 'up'
                  ? isEs
                    ? `📈 Evolución Positiva (+${reportData.trendDelta.toFixed(1)})`
                    : `📈 Improving Trend (+${reportData.trendDelta.toFixed(1)})`
                  : reportData.trend === 'down'
                  ? isEs
                    ? `📉 Tendencia en Descenso (${reportData.trendDelta.toFixed(1)})`
                    : `📉 Declining Trend (${reportData.trendDelta.toFixed(1)})`
                  : isEs
                  ? '➡️ Rendimiento Estable entre Períodos'
                  : '➡️ Stable Performance Across Periods'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.85rem',
                paddingTop: '0.5rem'
              }}
            >
              {PERIODS.map((p) => {
                const pData = reportData.perPeriod[p];
                const pMeta = getPerformanceMeta(pData.avg, lang);
                const heightPct =
                  pData.avg !== null ? Math.max(8, Math.min((pData.avg / 5.0) * 100, 100)) : 6;

                return (
                  <div
                    key={p}
                    onClick={() => handleScopeChange('single', p)}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, border-color 0.2s ease'
                    }}
                    title={isEs ? `Ver detalle del Período ${p}` : `View Period ${p} details`}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      {t('period')} {p}
                    </div>

                    <div className="ssm-period-bar-col">
                      <div style={{ fontSize: '1.4rem', marginBottom: '4px' }} aria-hidden="true">
                        {pMeta.emoji}
                      </div>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 800,
                          color: getGradeColor(pData.avg),
                          marginBottom: '4px'
                        }}
                      >
                        {pData.avg !== null ? pData.avg.toFixed(1) : '-'}
                      </div>
                      <div
                        className="ssm-period-bar-fill"
                        style={{
                          '--period-bar-h': `${heightPct}%`,
                          '--period-bar-color': getGradeColor(pData.avg)
                        }}
                      />
                    </div>

                    <div
                      style={{
                        width: '100%',
                        marginTop: '0.65rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--color-border)',
                        fontSize: '0.73rem',
                        color: 'var(--color-text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{isEs ? 'Entregas:' : 'Submitted:'}</span>
                        <strong>
                          {pData.gradedCount}/{pData.promediableCount}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{isEs ? 'Asistencia:' : 'Attend.:'}</span>
                        <span>
                          ✅{pData.presentCount} ❌{pData.absentCount} ⏰{pData.lateCount}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{isEs ? 'Observador:' : 'Notes:'}</span>
                        <strong>{pData.parsedNotes.length}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* GRAPHICAL BREAKDOWN OF ACTIVITIES */}
        <section className="ssm-subcard">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>
              🎯 {t('studentReportActivitiesDetail')}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
              {isEs ? 'Línea vertical = Nota mínima de aprobación (3.0)' : 'Vertical line = Minimum passing grade (3.0)'}
            </span>
          </div>

          {reportData.allActivityItems.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              {isEs
                ? '📭 No hay actividades registradas para este período.'
                : '📭 No activities registered for this period.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {reportData.allActivityItems.map((act) => {
                const pct = act.isGraded ? Math.max(4, Math.min((act.numGrade / 5.0) * 100, 100)) : 0;
                const color = act.isGraded ? getGradeColor(act.numGrade) : 'rgba(134,134,139,0.35)';
                const statusIcon = !act.isGraded
                  ? '📭'
                  : act.numGrade >= 4.5
                  ? '🏆'
                  : act.numGrade >= 4.0
                  ? '🌟'
                  : act.numGrade >= 3.0
                  ? '✅'
                  : '🚨';

                return (
                  <div
                    key={`${act.period}-${act.id}`}
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '10px',
                      border: `1px solid ${
                        !act.isGraded || act.numGrade < 3.0 ? 'rgba(255, 59, 48, 0.35)' : 'var(--color-border)'
                      }`
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span aria-hidden="true">{statusIcon}</span>
                        {scopeMode === 'all' && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(0, 113, 227, 0.12)',
                              color: 'var(--color-accent)'
                            }}
                          >
                            P{act.period}
                          </span>
                        )}
                        <strong style={{ fontSize: '0.9rem' }}>{act.name}</strong>
                        {act.date && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            ({act.date})
                          </span>
                        )}
                        {act.isAveraged === false && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 159, 10, 0.15)',
                              color: 'var(--color-warning)',
                              fontWeight: 600
                            }}
                          >
                            {isEs ? 'Formativa (No promedia)' : 'Formative (Not averaged)'}
                          </span>
                        )}
                        {act.attOnDate === 'absent' && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 59, 48, 0.14)',
                              color: 'var(--color-danger)',
                              fontWeight: 600
                            }}
                          >
                            ❌ {isEs ? 'Falla ese día' : 'Absent that day'}
                          </span>
                        )}
                        {act.attOnDate === 'late' && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 159, 10, 0.15)',
                              color: 'var(--color-warning)',
                              fontWeight: 600
                            }}
                          >
                            ⏰ {isEs ? 'Retardo ese día' : 'Late that day'}
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: act.isGraded ? color : 'var(--color-danger)'
                        }}
                      >
                        {act.isGraded ? act.numGrade.toFixed(1) : isEs ? 'Sin presentar ⚠️' : 'Missing ⚠️'}
                      </span>
                    </div>

                    <div
                      className="ssm-progress-track"
                      style={{
                        '--bar-pct': `${pct}%`,
                        '--bar-color': color
                      }}
                    >
                      <div className="ssm-pass-marker" title="3.0" />
                      <div className="ssm-progress-fill" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ATTENDANCE & OBSERVER SIDE-BY-SIDE DETAILS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.1rem' }}>
          {/* VISUAL ATTENDANCE TIMELINE */}
          <section className="ssm-subcard">
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>
              🗓️ {t('studentReportAttendanceDetail')}
            </h3>
            {reportData.allAttRecords.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                {isEs ? 'Sin fechas de asistencia registradas.' : 'No attendance dates recorded.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {reportData.allAttRecords.map((rec) => {
                  const cfg =
                    rec.status === 'present'
                      ? { icon: '✅', label: t('attPresent'), bg: 'rgba(52, 199, 89, 0.14)', border: 'rgba(52, 199, 89, 0.4)' }
                      : rec.status === 'absent'
                      ? { icon: '❌', label: t('attAbsent'), bg: 'rgba(255, 59, 48, 0.16)', border: 'rgba(255, 59, 48, 0.45)' }
                      : rec.status === 'late'
                      ? { icon: '⏰', label: t('attLate'), bg: 'rgba(255, 159, 10, 0.16)', border: 'rgba(255, 159, 10, 0.45)' }
                      : { icon: '⚪', label: t('attNotTaken'), bg: 'var(--color-bg-card)', border: 'var(--color-border)' };

                  return (
                    <div
                      key={`${rec.period}-${rec.date}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '0.32rem 0.6rem',
                        borderRadius: '8px',
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                      title={`${rec.date}: ${cfg.label}${rec.lateTime ? ` (${rec.lateTime})` : ''}`}
                    >
                      <span aria-hidden="true">{cfg.icon}</span>
                      {scopeMode === 'all' && <span style={{ opacity: 0.7 }}>P{rec.period}</span>}
                      <span>{rec.date.split('-').slice(1).join('/')}</span>
                      {rec.lateTime && <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>({rec.lateTime})</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* VISUAL OBSERVER / CONVIVENCIA TIMELINE */}
          <section className="ssm-subcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>
                📋 {t('studentReportObservationsDetail')}
              </h3>
              {onAddObservation && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleRequestClose();
                    onAddObservation(student);
                  }}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.76rem', gap: '4px' }}
                >
                  <Plus size={13} aria-hidden="true" />
                  {t('newObservation')}
                </button>
              )}
            </div>

            {reportData.allNotes.length === 0 ? (
              <div
                style={{
                  background: 'rgba(52, 199, 89, 0.1)',
                  border: '1px solid rgba(52, 199, 89, 0.3)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  fontSize: '0.86rem'
                }}
              >
                <span style={{ fontSize: '1.4rem' }} aria-hidden="true">
                  🌟
                </span>
                <span>
                  {isEs
                    ? '¡Excelente! El estudiante no registra observaciones negativas en este alcance.'
                    : 'Great! The student has no negative observations in this scope.'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                {reportData.allNotes.map((obs, idx) => (
                  <div
                    key={`${obs.period}-${idx}`}
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${obs.color}`,
                      borderTop: '1px solid var(--color-border)',
                      borderRight: '1px solid var(--color-border)',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      fontSize: '0.83rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span aria-hidden="true">{obs.icon}</span>
                        {scopeMode === 'all' && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                            P{obs.period}
                          </span>
                        )}
                        {obs.date && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                            {obs.date}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--color-text-primary)' }}>{obs.note}</div>
                    </div>

                    {onSendObservationEmail && (
                      <button
                        type="button"
                        onClick={() => onSendObservationEmail(student, obs.raw)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary)',
                          flexShrink: 0
                        }}
                        title={t('sendEmail')}
                        aria-label={t('sendEmail')}
                      >
                        <Mail size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
