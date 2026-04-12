import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { PDFGenerator } from '../services/PDFGenerator';
import { Download, Leaf } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Downloads() {
  const { t, settings } = useSettings();
  const [courses, setCourses] = useState([]);
  const [reportType, setReportType] = useState('students');
  const [scope, setScope] = useState('all');
  const [studentScope, setStudentScope] = useState('all');
  const [observerIncludeVPS, setObserverIncludeVPS] = useState(true);
  const [periodScope, setPeriodScope] = useState('current'); // 'all' | 'current' | '1'-'4'
  const [ecoMode, setEcoMode] = useState(false);

  const [selectedFields, setSelectedFields] = useState({
      studentCount: false,
      vpsCode: true,
      name: true,
      age: true,
      jornada: true,
      parentName: true,
      parentPhone: true,
      parentEmail: true,
      generalObservations: false
  });

  useEffect(() => {
    setCourses(DataStore.getCourses());
  }, []);

  useEffect(() => {
    setStudentScope('all');
  }, [scope]);

  const getEffectivePeriod = () => {
    if (periodScope === 'current') return settings.currentPeriod || '1';
    return periodScope;
  };

  const handleDownload = () => {
      const effectivePeriod = getEffectivePeriod();
      if (reportType === 'students') {
          PDFGenerator.generateStudentDataReport(scope, selectedFields);
      } else if (reportType === 'grades') {
          PDFGenerator.generateGradesReport(scope, effectivePeriod);
      } else if (reportType === 'attendance') {
          PDFGenerator.generateAttendanceReport(scope, effectivePeriod);
      } else if (reportType === 'observer') {
          PDFGenerator.generateObserverReport(scope, studentScope, observerIncludeVPS, effectivePeriod, settings.subject, ecoMode);
      }
  };

  const toggleField = (field) => {
      setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const showPeriodSelector = reportType !== 'students';

  // Get students with annotations for the selected periods (for the student filter dropdown)
  const getStudentsWithAnnotations = () => {
    if (scope === 'all') return [];
    const students = DataStore.getStudentsByCourse(scope)
      .sort((a, b) => a.name.localeCompare(b.name));
    const effectivePeriod = getEffectivePeriod();
    const periods = effectivePeriod === 'all' ? ['1','2','3','4'] : [effectivePeriod];

    return students.filter(s => {
      if (!s.annotations || typeof s.annotations !== 'object') return false;
      return periods.some(p => s.annotations[p] && s.annotations[p].length > 0);
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('downloadsTitle')}</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>{t('downloadsSubtitle')}</p>

        <div className="card" style={{ padding: '2rem' }}>
            {/* Report Type */}
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{t('selectReportType')}</h3>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'students', label: t('reportStudentList') },
                  { value: 'grades', label: t('reportGradebook') },
                  { value: 'attendance', label: t('reportAttendance') },
                  { value: 'observer', label: t('tabObserver') || 'Observer' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.1rem' }}>
                      <input
                          type="radio"
                          name="reportType"
                          value={opt.value}
                          checked={reportType === opt.value}
                          onChange={() => setReportType(opt.value)}
                          style={{ width: '18px', height: '18px' }}
                      />
                      {opt.label}
                  </label>
                ))}
            </div>

            {/* Field Selection (Only for Student List) */}
            {reportType === 'students' && (
                <div style={{ marginBottom: '2rem', background: 'var(--color-bg-body)', padding: '1.5rem', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>{t('includeFields')}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        {Object.keys(selectedFields).map(key => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedFields[key]}
                                    onChange={() => toggleField(key)}
                                />
                                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Scope Selection */}
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{t('selectScope')}</h3>
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="scope"
                            value="all"
                            checked={scope === 'all'}
                            onChange={() => setScope('all')}
                        />
                        {t('allCourses')}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="scope"
                                value="single"
                                checked={scope !== 'all'}
                                onChange={() => setScope(courses[0] || '')}
                            />
                            {t('specificCourse')}
                        </label>
                        <select
                            className="input-field"
                            style={{ padding: '4px 8px', minWidth: '150px' }}
                            value={scope === 'all' ? '' : scope}
                            onChange={(e) => setScope(e.target.value)}
                            disabled={scope === 'all'}
                        >
                            {courses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Student filter for observer */}
                {reportType === 'observer' && scope !== 'all' && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '2rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('studentFilter')}</span>
                        <select
                            className="input-field"
                            style={{ padding: '4px 8px', minWidth: '200px' }}
                            value={studentScope}
                            onChange={(e) => setStudentScope(e.target.value)}
                        >
                            <option value="all">{t('allStudentsWithAnnotations')}</option>
                            {getStudentsWithAnnotations().map(s => {
                                const totalNotes = ['1','2','3','4'].reduce((sum, p) =>
                                    sum + ((s.annotations && s.annotations[p]) || []).length, 0);
                                return (
                                    <option key={s.id} value={s.id}>{s.name} ({totalNotes})</option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* VPS toggle for observer */}
                {reportType === 'observer' && (
                    <div style={{ marginTop: '1rem', marginLeft: '2rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={observerIncludeVPS}
                                onChange={(e) => setObserverIncludeVPS(e.target.checked)}
                            />
                            {t('includeVPS')}
                        </label>
                    </div>
                )}
            </div>

            {/* Period Selection (not for student list) */}
            {showPeriodSelector && (
                <>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{t('selectPeriod')}</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="period"
                                value="all"
                                checked={periodScope === 'all'}
                                onChange={() => setPeriodScope('all')}
                            />
                            {t('allPeriods')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="period"
                                value="current"
                                checked={periodScope === 'current'}
                                onChange={() => setPeriodScope('current')}
                            />
                            {t('period')} {settings.currentPeriod || '1'} ({t('period').toLowerCase()} actual)
                        </label>
                        {['1','2','3','4'].map(p => (
                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="period"
                                    value={p}
                                    checked={periodScope === p}
                                    onChange={() => setPeriodScope(p)}
                                />
                                {t('period')} {p}
                            </label>
                        ))}
                    </div>
                </>
            )}

            {/* Eco toggle (observer only) */}
            {reportType === 'observer' && (
                <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '1rem 1.2rem',
                    background: ecoMode ? 'rgba(52, 199, 89, 0.1)' : 'var(--color-bg-body)',
                    borderRadius: '10px',
                    border: ecoMode ? '1px solid var(--color-success)' : '1px solid var(--color-border)',
                    transition: 'all 0.2s ease'
                }}>
                    <Leaf size={20} style={{ color: ecoMode ? 'var(--color-success)' : 'var(--color-text-secondary)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Eco</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                            Ahorra papel: letra compacta, 2 columnas, sin líneas decorativas
                        </span>
                    </div>
                    <div
                        onClick={() => setEcoMode(!ecoMode)}
                        style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            background: ecoMode ? 'var(--color-success)' : '#ccc',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background 0.2s ease',
                            flexShrink: 0
                        }}
                    >
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'white',
                            position: 'absolute',
                            top: '2px',
                            left: ecoMode ? '22px' : '2px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                    </div>
                </div>
            )}

            {/* Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleDownload}
                    className="btn"
                    style={{ padding: '0.8rem 2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                    <Download size={24} />
                    {t('downloadPDF')}
                </button>
            </div>
        </div>
    </div>
  );
}
