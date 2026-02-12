import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useGlobalModal } from '../context/GlobalModalContext';

export function StudentRegistration() {
  const navigate = useNavigate();
  const { t } = useSettings();
  const { showAlert } = useGlobalModal();
  const [formData, setFormData] = useState({
    name: '',
    course: '',
    birthDate: '',
    age: '',
    parentName: '',
    parentPhone: '',
    parentPhone2: '',
    parentEmail: '',
    vpsCode: '',
    jornada: 'Mañana', // Default
    genericObs: ''
  });

  const [courses, setCourses] = useState([]);
  
  // Load courses
  useState(() => {
      setCourses(DataStore.getCourses());
  }, []);

  // Auto-sync Jornada with Course
  useEffect(() => {
      if (formData.course) {
          if (formData.course.includes('JT')) {
              setFormData(prev => ({ ...prev, jornada: 'Tarde' }));
          } else {
              setFormData(prev => ({ ...prev, jornada: 'Mañana' }));
          }
      }
  }, [formData.course]);

  const calculateAge = (dob) => {
      if (!dob) return '';
      const birthDate = new Date(dob);
      const diffMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(diffMs); 
      return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'birthDate') {
        const age = calculateAge(value);
        setFormData({ ...formData, birthDate: value, age: age });
    } else {
        setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    DataStore.addStudent(formData);
    showAlert(t('registerTitle'), t('studentRegistered'));
    setFormData({
      name: '',
      course: '',
      age: '',
      parentName: '',
      parentPhone: '',
      parentPhone2: '',
      parentEmail: '',
      vpsCode: '',
      jornada: 'Mañana',
      genericObs: ''
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>{t('registerTitle')}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('registerSubtitle')}</p>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('fullName')}</label>
            <input 
              className="input-field"
              name="name" 
              placeholder="e.g. John Doe" 
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('course')}</label>
              <select 
                className="input-field"
                name="course" 
                value={formData.course}
                onChange={handleChange}
                required 
              >
                  <option value="">{t('selectCourse')}</option>
                  {courses.map(c => (
                      <option key={c} value={c}>{c}</option>
                  ))}
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
               <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('dob')}</label>
                  <input 
                    className="input-field"
                    name="birthDate" 
                    type="date"
                    value={formData.birthDate || ''}
                    onChange={handleChange}
                    required 
                  />
               </div>
               <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('age')}</label>
                  <input 
                    className="input-field"
                    value={formData.age || ''}
                    readOnly
                    style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-secondary)' }}
                    title="Auto-calculated from DOB"
                  />
               </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('jornada')}</label>
              <select 
                  className="input-field" 
                  name="jornada" 
                  value={formData.jornada} 
                  disabled // Locked
                  style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-secondary)' }}
              >
                 <option value="Mañana">Mañana</option>
                 <option value="Tarde">Tarde</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('vpsCode')}</label>
              <input 
                className="input-field"
                name="vpsCode" 
                placeholder="Optional" 
                value={formData.vpsCode}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('parentName')}</label>
              <input 
                className="input-field"
                name="parentName" 
                placeholder="Guardian's Name" 
                value={formData.parentName}
                onChange={handleChange}
                required 
              />
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('parentPhone')}</label>
              <input 
                className="input-field"
                name="parentPhone" 
                placeholder="Primary Phone" 
                value={formData.parentPhone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('parentPhone2')}</label>
              <input 
                className="input-field"
                name="parentPhone2" 
                placeholder="Alternative Phone (Optional)" 
                value={formData.parentPhone2}
                onChange={handleChange}
              />
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('parentEmail')}</label>
              <input 
                className="input-field"
                name="parentEmail" 
                type="email"
                placeholder="parent@example.com (Optional)" 
                value={formData.parentEmail}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('genObs')}</label>
            <textarea 
                className="input-field" 
                name="genericObs" 
                rows="3"
                placeholder="Medical notes, allergies, behavior, etc." 
                value={formData.genericObs}
                onChange={handleChange}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn" style={{ flex: 1 }}>
              <Save size={18} style={{ marginRight: '8px' }} />
              {t('saveStudent')}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => navigate('/')}
            >
              {t('cancel')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
