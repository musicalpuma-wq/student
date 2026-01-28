import { useState } from 'react';
import { DataStore } from '../services/DataStore';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';

export function StudentRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    course: '',
    age: '',
    parentName: '',
    parentName: '',
    parentPhone: '',
    parentPhone2: '',
    parentEmail: '',
    vpsCode: '',
    jornada: 'Mañana', // Default
    genericObs: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    DataStore.addStudent(formData);
    alert('Student Registered Successfully!');
    setFormData({
      name: '',
      course: '',
      age: '',
      parentName: '',
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
        <h1 style={{ fontSize: '2rem' }}>Register Student</h1>
        <p style={{ color: '#86868b' }}>Enter the student's details below.</p>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Full Name</label>
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
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Course</label>
              <input 
                className="input-field"
                name="course" 
                placeholder="e.g. 6-A" 
                value={formData.course}
                onChange={handleChange}
                required 
              />
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Age</label>
              <input 
                className="input-field"
                name="age" 
                type="number"
                placeholder="e.g. 12" 
                value={formData.age}
                onChange={handleChange}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Jornada</label>
              <select 
                  className="input-field" 
                  name="jornada" 
                  value={formData.jornada} 
                  onChange={handleChange}
              >
                 <option value="Mañana">Mañana</option>
                 <option value="Tarde">Tarde</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>VPS Code</label>
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
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Parent Name</label>
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
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Parent Phone</label>
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
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Parent Phone 2</label>
              <input 
                className="input-field"
                name="parentPhone2" 
                placeholder="Alternative Phone (Optional)" 
                value={formData.parentPhone2}
                onChange={handleChange}
              />
            </div>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Parent Email</label>
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
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>General Observations</label>
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
              Save Student
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
