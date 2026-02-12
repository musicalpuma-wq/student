import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { PDFGenerator } from '../services/PDFGenerator';
import { Download, FileText, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Downloads() {
  const { t } = useSettings();
  const [courses, setCourses] = useState([]);
  const [reportType, setReportType] = useState('students'); // 'students' | 'grades'
  const [scope, setScope] = useState('all'); // 'all' | courseId
  
  // Field Selector for Student Data
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

  const handleDownload = () => {
      if (reportType === 'students') {
          PDFGenerator.generateStudentDataReport(scope, selectedFields);
      } else {
          PDFGenerator.generateGradesReport(scope);
      }
  };

  const toggleField = (field) => {
      setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('downloadsTitle')}</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>{t('downloadsSubtitle')}</p>

        <div className="card" style={{ padding: '2rem' }}>
            {/* Report Type */}
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{t('selectReportType')}</h3>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.1rem' }}>
                    <input 
                        type="radio" 
                        name="reportType" 
                        value="students" 
                        checked={reportType === 'students'}
                        onChange={() => setReportType('students')}
                        style={{ width: '18px', height: '18px' }}
                    />
                    {t('reportStudentList')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.1rem' }}>
                    <input 
                        type="radio" 
                        name="reportType" 
                        value="grades" 
                        checked={reportType === 'grades'}
                        onChange={() => setReportType('grades')}
                        style={{ width: '18px', height: '18px' }}
                    />
                    {t('reportGradebook')}
                </label>
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
            </div>

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
