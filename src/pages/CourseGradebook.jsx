import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DataStore } from '../services/DataStore';
import { Plus, Calendar, FileText, UserSquare2, ChevronLeft, Save, ArrowUpDown, Mail, GripVertical, Edit2, ArrowRight } from 'lucide-react';

export function CourseGradebook() {
  const { courseId } = useParams();
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [materials, setMaterials] = useState([]); // [{id, name}]
  const [activeTab, setActiveTab] = useState('grades'); // grades, attendance, observer, materials
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingMaterial, setEditingMaterial] = useState(null); // { id, name }
  const [newObservation, setNewObservation] = useState(null); // { studentId, studentName, date: '', note: '' }
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [newAttendanceDate, setNewAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [viewingStudent, setViewingStudent] = useState(null); // Student object to view details
  const [isEditingStudent, setIsEditingStudent] = useState(false); // Toggle edit mode in modal
  const [isEditingCourseName, setIsEditingCourseName] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [editingActivity, setEditingActivity] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load data
    setStudents(DataStore.getStudentsByCourse(courseId));
    setActivities(DataStore.getActivities(courseId));
    setMaterials(DataStore.getMaterials(courseId));
  }, [courseId, refreshTrigger]);

  const refreshData = () => setRefreshTrigger(prev => prev + 1);

  // Sorting Logic
  const handleSort = (key) => {
    setSortConfig(current => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortedStudents = () => {
    const sorted = [...students];
    sorted.sort((a, b) => {
      let valA, valB;

      if (sortConfig.key === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortConfig.key === 'vps') {
         // Try numeric sort if possible, else string
         const vpsA = (a.vpsCode || '').replace(/\D/g, '');
         const vpsB = (b.vpsCode || '').replace(/\D/g, '');
         if (vpsA && vpsB) {
             valA = parseInt(vpsA);
             valB = parseInt(vpsB);
         } else {
             valA = a.vpsCode || '';
             valB = b.vpsCode || '';
         }
      } else {
        // Sorting by grade (activity ID)
        valA = parseFloat((a.grades || {})[sortConfig.key]) || -1; // Treat no grade as lowest
        valB = parseFloat((b.grades || {})[sortConfig.key]) || -1;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  // --- Grades Logic ---
  const handleAddActivity = () => {
    const name = prompt("Enter Activity Name/Description:");
    if (name) {
      DataStore.addActivity(courseId, name);
      refreshData();
    }
  };

  const handleUpdateActivity = (e) => {
    e.preventDefault();
    if (editingActivity) {
        DataStore.updateActivity(courseId, {
            id: editingActivity.id,
            name: editingActivity.name,
            date: editingActivity.date
        });
        setEditingActivity(null);
        refreshData();
    }
  };
  
  const handleSaveObservation = (e) => {
      e.preventDefault();
      if (newObservation && newObservation.note) {
          const student = students.find(s => s.id === newObservation.studentId);
          if (student) {
             const dateStr = newObservation.date || new Date().toISOString().split('T')[0];
             const newAnnotation = `[${dateStr}] ${newObservation.note}`;
             const updatedStudent = { 
                  ...student, 
                  annotations: [...(student.annotations || []), newAnnotation]
              };
              DataStore.updateStudent(updatedStudent);
              // Update local state
              setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
          }
          setNewObservation(null);
      }
  };


  // --- Materials Logic ---
  const handleAddMaterial = () => {
    const name = prompt("Enter Material/Column Name (e.g. Guitarra):");
    if (name) {
      DataStore.addMaterialColumn(courseId, name);
      refreshData();
    }
  };

  const handleMaterialValueChange = (student, materialId, value) => {
      const updatedStudent = { 
          ...student, 
          materials: { ...(student.materials || {}), [materialId]: value } 
      };
      DataStore.updateStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  const calculateStudentIndex = (studentId) => {
      // Return 1-based index from the original unsorted list (or just count current view?)
      // Requirement: "generar un número que numere a los estudiantes... siempre el de arriba va a ser el 1"
      // This means the index depends on the Rendered Order.
      // So detailed inside the map loop.
      return 0; 
  };

  const handleGradeChange = (student, activityId, value) => {
    // Clone student to update state immediately for UI responsiveness
    const updatedStudent = { ...student, grades: { ...student.grades, [activityId]: value } };
    DataStore.updateStudent(updatedStudent);
    // No full refresh needed if we update local state, but for simplicity we can refresh or just mutate local list
    // Ideally we update the local `students` state to match
    setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  const calculateAverage = (student) => {
    const grades = Object.values(student.grades || {}).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (grades.length === 0) return '-';
    const sum = grades.reduce((a, b) => a + b, 0);
    return (sum / grades.length).toFixed(1);
  };

  const canStudentPass = (student) => {
    const avg = calculateAverage(student);
    if (avg === '-') return true; 
    return parseFloat(avg) >= 3.0;
  };

  // --- Attendance Logic ---
  const toggleAttendance = (student) => {
    const currentStatus = student.attendance?.[selectedDate] || 'present'; // Default present if not set? User said 'assign'.
    // Let's cycle: present -> absent -> late -> present
    const statusMap = { 'present': 'absent', 'absent': 'late', 'late': 'present', undefined: 'present' };
    const nextStatus = statusMap[currentStatus] || 'present';
    
    const updatedStudent = { 
        ...student, 
        attendance: { ...student.attendance, [selectedDate]: nextStatus } 
    };
    DataStore.updateStudent(updatedStudent);
    setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  // --- Observer Logic ---
  const handleSendToParent = (student, note) => {
      if (!student.parentEmail) {
          alert('No parent email registered for this student.');
          const text = `Student: ${student.name}\nObservation: ${note}`;
          navigator.clipboard.writeText(text);
          alert('Observation copied to clipboard instead.');
          return;
      }
      
      const subject = `Reporte de observación en clase de Música - ${student.name}`;
      const body = `Este es un correo automático, por favor no responder\n\nApreciado acudiente:\n\nLe escribo para informarle sobre una anotación realizada en el observador del estudiante ${student.name} durante la clase de música:\n\n"${note}"\n\nComparto esta información con el ánimo de invitar a la reflexión en casa y trabajar conjuntamente en el proceso formativo del estudiante.\n\nCordialmente,\nMauricio Herrera\nProfesor de Música\nColegio Alfonso López Pumarejo`;
      
      // Copy to clipboard as fallback/convenience
      navigator.clipboard.writeText(body);
      
      // Open Mailto
      window.location.href = `mailto:${student.parentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  
  const handleUpdateStudentDetails = (e) => {
      e.preventDefault();
      if (viewingStudent) {
          DataStore.updateStudent(viewingStudent);
          setIsEditingStudent(false);
          setStudents(prev => prev.map(s => s.id === viewingStudent.id ? viewingStudent : s));
          refreshData(); // To update list view if name changed
      }
  };

  const handleRenameCourse = (e) => {
      e.preventDefault();
      if (newCourseName && newCourseName !== courseId) {
          DataStore.updateCourseName(courseId, newCourseName);
          setIsEditingCourseName(false);
          navigate(`/course/${newCourseName}`);
      } else {
          setIsEditingCourseName(false);
      }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ChevronLeft size={20} />
        </Link>
        <div>
            {isEditingCourseName ? (
                <form onSubmit={handleRenameCourse} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                        className="input-field"
                        style={{ fontSize: '1.5rem', fontWeight: 700, padding: '4px 8px', width: '200px' }}
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn" style={{ padding: '8px' }} title="Save Name">
                        <Save size={18} />
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '8px' }}
                        onClick={() => setIsEditingCourseName(false)}
                        title="Cancel"
                    >
                        <ChevronLeft size={18} style={{ transform: 'rotate(180deg)' }} /> 
                        {/* Using ChevronLeft rotated as a generic 'back/cancel' or X icon if imported */}
                    </button>
                </form>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>{courseId}</h1>
                    <button 
                        onClick={() => {
                            setNewCourseName(courseId);
                            setIsEditingCourseName(true);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }}
                        title="Rename Course"
                    >
                        <Edit2 size={18} />
                    </button>
                </div>
            )}
            <p style={{ color: 'var(--color-text-secondary)' }}>Course Management</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        <button 
            onClick={() => setActiveTab('grades')}
            style={{ 
                padding: '0.6rem 1.2rem', 
                background: activeTab === 'grades' ? 'var(--color-accent)' : 'transparent',
                color: activeTab === 'grades' ? 'white' : 'var(--color-text-secondary)',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 500,
                cursor: 'pointer'
            }}>
            Grades
        </button>
        <button 
            onClick={() => setActiveTab('attendance')}
            style={{ 
                padding: '0.6rem 1.2rem', 
                background: activeTab === 'attendance' ? 'var(--color-accent)' : 'transparent',
                color: activeTab === 'attendance' ? 'white' : 'var(--color-text-secondary)',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 500,
                cursor: 'pointer'
            }}>
            Attendance
        </button>
        <button 
            onClick={() => setActiveTab('observer')}
            style={{ 
                padding: '0.6rem 1.2rem', 
                background: activeTab === 'observer' ? 'var(--color-accent)' : 'transparent',
                color: activeTab === 'observer' ? 'white' : 'var(--color-text-secondary)',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 500,
                cursor: 'pointer'
            }}>
            Observer
        </button>
        <button 
            onClick={() => setActiveTab('materials')}
            style={{ 
                padding: '0.6rem 1.2rem', 
                background: activeTab === 'materials' ? 'var(--color-accent)' : 'transparent',
                color: activeTab === 'materials' ? 'white' : 'var(--color-text-secondary)',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 500,
                cursor: 'pointer'
            }}>
            Materials Assignment
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto', position: 'relative' }}>
        {activeTab === 'grades' && (
            <table style={{ width: '100%', minWidth: '800px' }}>
                <thead>
                    <tr>
                        <th style={{ width: '50px', textAlign: 'center', color: '#86868b' }}>#</th>
                        <th 
                            style={{ width: '80px', cursor: 'pointer' }} 
                            onClick={() => handleSort('vps')}
                            className="hover-bg-gray"
                        >
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                VPS
                                <ArrowUpDown size={14} color={sortConfig.key === 'vps' ? 'var(--color-accent)' : '#ccc'} />
                            </div>
                        </th>
                        <th 
                            style={{ width: '250px', cursor: 'pointer' }}
                            onClick={() => handleSort('name')}
                            className="hover-bg-gray"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Student Name
                                <ArrowUpDown size={14} color={sortConfig.key === 'name' ? 'var(--color-accent)' : '#ccc'} />
                            </div>
                        </th>
                        {activities.map(act => (
                            <th 
                                key={act.id} 
                                style={{ minWidth: '100px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                                className="hover-bg-gray"
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <div 
                                        onClick={() => setEditingActivity(act)}
                                        title="Click to edit details"
                                        style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}
                                    >
                                        {act.date || 'Set Date'}
                                    </div>
                                    <div 
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => handleSort(act.id)}
                                    >
                                        {act.name}
                                        <ArrowUpDown size={14} color={sortConfig.key === act.id ? 'var(--color-accent)' : '#ccc'} />
                                    </div>
                                </div>
                            </th>
                        ))}
                        <th style={{ width: '50px', padding: 0 }}>
                            <button onClick={handleAddActivity} style={{ 
                                border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-accent)' 
                            }}>
                                <Plus size={20} />
                            </button>
                        </th>
                        <th style={{ width: '100px', textAlign: 'center', color: 'var(--color-text-primary)' }}>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    {getSortedStudents().map((student, index) => (
                        <tr key={student.id}>
                            <td style={{ textAlign: 'center', color: '#86868b', fontSize: '0.9rem' }}>{index + 1}</td>
                            <td style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{student.vpsCode}</td>
                            <td style={{ fontWeight: 500 }}>{student.name}</td>
                            {activities.map(act => {
                                const grade = (student.grades || {})[act.id];
                                const numGrade = parseFloat(grade);
                                let barColor = '#e5e5ea';
                                let isGradient = false;

                                if (!isNaN(numGrade)) {
                                    if (numGrade <= 2.0) barColor = '#ff3b30'; // Red
                                    else if (numGrade <= 2.9) barColor = '#ff9f0a'; // Orange
                                    else if (numGrade <= 4.0) barColor = '#30d158'; // Bright Green
                                    else { // > 4.0
                                      barColor = 'linear-gradient(to right, #34c759, #30b0c7)'; // Green to Teal gradient
                                      isGradient = true;
                                    }
                                }

                                return (
                                <td key={act.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        {/* Progress Bar */}
                                        <div style={{ 
                                            width: '60px', 
                                            height: '4px', 
                                            background: '#f5f5f7', 
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{ 
                                                width: !isNaN(numGrade) ? `${(Math.min(numGrade, 5) / 5) * 100}%` : '0%',
                                                height: '100%',
                                                background: isGradient ? barColor : barColor,
                                                backgroundImage: isGradient ? barColor : 'none',
                                                borderRadius: '2px',
                                                transition: 'width 0.3s ease, background 0.3s ease'
                                            }} />
                                        </div>

                                        <input 
                                            type="number" 
                                            step="0.1"
                                            max="5.0"
                                            min="0.0"
                                            style={{ 
                                                width: '60px', 
                                                padding: '4px', 
                                                textAlign: 'center', 
                                                border: '1px solid #d2d2d7', 
                                                borderRadius: '6px',
                                                fontSize: '0.95rem',
                                                fontFamily: 'var(--font-family)'
                                            }}
                                            value={grade || ''}
                                            onChange={(e) => handleGradeChange(student, act.id, e.target.value)}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) {
                                                    // Format to 1 decimal place if it's a valid number
                                                    const formatted = val.toFixed(1);
                                                    if (formatted !== e.target.value) {
                                                        handleGradeChange(student, act.id, formatted);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </td>
                            )})}
                            <td></td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{calculateAverage(student)}</td>
                        </tr>
                    ))}
                    {students.length === 0 && (
                        <tr><td colSpan={activities.length + 3} style={{textAlign: 'center', padding: '2rem'}}>No students in this course.</td></tr>
                    )}
                </tbody>
            </table>
        )}

        {activeTab === 'attendance' && (
            <div style={{ paddingBottom: '1rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                     <button 
                         onClick={() => setShowAddDateModal(true)} 
                         className="btn btn-secondary"
                     >
                         <Plus size={16} style={{ marginRight: '6px' }} />
                         Add Date
                     </button>
                </div>
                
                <table style={{ width: '100%', minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '50px', textAlign: 'center', color: '#86868b' }}>#</th>
                            <th 
                                style={{ width: '100px', cursor: 'pointer' }}
                                onClick={() => handleSort('vps')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    VPS
                                    {sortConfig.key === 'vps' && <ArrowUpDown size={14} />}
                                </div>
                            </th>
                            <th 
                                style={{ width: '250px', cursor: 'pointer' }}
                                onClick={() => handleSort('name')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Student Name
                                    {sortConfig.key === 'name' && <ArrowUpDown size={14} />}
                                </div>
                            </th>
                            {/* Derive dates from all students' attendance records */}
                            {Array.from(new Set(students.flatMap(s => Object.keys(s.attendance || {})))).sort().map(date => (
                                <th key={date} style={{ textAlign: 'center', minWidth: '50px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
                                        {date.split('-').slice(1).join('/')}
                                    </div>
                                </th>
                            ))}
                            <th style={{ textAlign: 'center', color: 'var(--color-success)', width: '40px' }} title="Present">P</th>
                            <th style={{ textAlign: 'center', color: 'var(--color-danger)', width: '40px' }} title="Absent">A</th>
                            <th style={{ textAlign: 'center', color: 'var(--color-warning)', width: '40px' }} title="Late">L</th>
                        </tr>
                    </thead>
                    <tbody>
                         {getSortedStudents().map(student => {
                             const dates = Array.from(new Set(students.flatMap(s => Object.keys(s.attendance || {})))).sort();
                             // Calculate totals
                             const counts = { present: 0, absent: 0, late: 0 };
                             Object.values(student.attendance || {}).forEach(status => {
                                 if (counts[status] !== undefined) counts[status]++;
                             });

                             return (
                                <tr key={student.id}>
                                    <td style={{ textAlign: 'center', color: '#86868b', fontSize: '0.9rem' }}>{calculateStudentIndex(student.id) || students.indexOf(student) + 1}</td>
                                    <td style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{student.vpsCode}</td>
                                    <td style={{ fontWeight: 500 }}>{student.name}</td>
                                    {dates.map(date => {
                                        const status = student.attendance?.[date] || 'present'; // Default assumption if column exists? Or null?
                                        // If the date exists in the derived set, we show it. 
                                        // If student has no record, we can default to 'present' or '?'
                                        // Let's toggle on click
                                        const colorMap = { 'present': 'green', 'absent': 'red', 'late': 'orange' };
                                        const dotColor = status === 'present' ? 'var(--color-success)' : status === 'absent' ? 'var(--color-danger)' : 'var(--color-warning)';
                                        
                                        return (
                                            <td 
                                                key={date} 
                                                style={{ textAlign: 'center', cursor: 'pointer' }}
                                                onClick={() => {
                                                    const next = { 'present': 'absent', 'absent': 'late', 'late': 'present' }[status] || 'present';
                                                    const updated = { 
                                                        ...student, 
                                                        attendance: { ...student.attendance, [date]: next } 
                                                    };
                                                    DataStore.updateStudent(updated);
                                                    setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
                                                }}
                                            >
                                                <div style={{ 
                                                    width: '12px', 
                                                    height: '12px', 
                                                    borderRadius: '50%', 
                                                    background: dotColor,
                                                    margin: '0 auto'
                                                }} title={status} />
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-success)' }}>{counts.present}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-danger)' }}>{counts.absent}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-warning)' }}>{counts.late}</td>
                                </tr>
                             );
                         })}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'materials' && (
            <table style={{ width: '100%', minWidth: '800px' }}>
                <thead>
                    <tr>
                         <th style={{ width: '50px', textAlign: 'center', color: '#86868b' }}>#</th>
                         <th 
                            style={{ width: '100px', cursor: 'pointer' }}
                            onClick={() => handleSort('vps')}
                         >
                            VPS
                         </th>
                         <th 
                            style={{ width: '250px', cursor: 'pointer' }}
                            onClick={() => handleSort('name')}
                         >
                            Student Name
                         </th>
                         {materials.map(mat => (
                             <th key={mat.id} style={{ minWidth: '150px' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                     {mat.name}
                                     {/* Rename logic could go here */}
                                 </div>
                             </th>
                         ))}
                         <th style={{ width: '50px', padding: 0 }}>
                            <button onClick={handleAddMaterial} style={{ 
                                border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-accent)' 
                            }}>
                                <Plus size={20} />
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {getSortedStudents().map((student, index) => (
                        <tr key={student.id}>
                            <td style={{ textAlign: 'center', color: '#86868b' }}>{index + 1}</td>
                            <td>{student.vpsCode}</td>
                            <td style={{ fontWeight: 500 }}>{student.name}</td>
                            {materials.map(mat => (
                                <td key={mat.id} style={{ padding: '0.5rem' }}>
                                    <input 
                                        className="input-field"
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                        placeholder="Assign..."
                                        value={student.materials?.[mat.id] || ''}
                                        onChange={(e) => handleMaterialValueChange(student, mat.id, e.target.value)}
                                    />
                                </td>
                            ))}
                            <td></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}

        {activeTab === 'observer' && (
             <table>
                <thead>
                    <tr>
                        <th 
                            style={{ width: '200px', cursor: 'pointer' }}
                            onClick={() => handleSort('name')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Student Name
                                {sortConfig.key === 'name' && <ArrowUpDown size={14} />}
                            </div>
                        </th>
                        <th>Observations</th>
                        <th style={{ width: '100px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {getSortedStudents().map(student => (
                        <tr key={student.id}>
                            <td style={{ fontWeight: 500, verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {student.name}
                                    <button 
                                        onClick={() => setViewingStudent(student)}
                                        className="btn btn-secondary"
                                        style={{ padding: '2px 6px', fontSize: '0.7rem', height: 'auto', minHeight: 'auto' }}
                                        title="View Details"
                                    >
                                        Info
                                    </button>
                                </div>
                            </td>
                            <td>
                                {student.annotations && student.annotations.length > 0 ? (
                                    <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                                        {student.annotations.map((note, i) => (
                                            <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                                {note} 
                                                <button 
                                                    style={{ 
                                                        marginLeft: '10px', 
                                                        background: 'none', 
                                                        border: '1px solid var(--color-border)', 
                                                        borderRadius: '6px',
                                                        cursor: 'pointer', 
                                                        color: 'var(--color-text-primary)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500
                                                    }}
                                                    title="Send to Parent via Email"
                                                    onClick={() => handleSendToParent(student, note)}
                                                >
                                                    <Mail size={14} />
                                                    Send to parent
                                                    <ArrowRight size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: '#ccc', fontStyle: 'italic' }}>No observations.</span>
                                )}
                            </td>
                            <td style={{ verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                                <button 
                                    onClick={() => setNewObservation({ 
                                        studentId: student.id, 
                                        studentName: student.name, 
                                        date: new Date().toISOString().split('T')[0], 
                                        note: '' 
                                    })} 
                                    className="btn btn-secondary"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    + Add Note
                                </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        )}
      </div>

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '400px', padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Edit Activity</h3>
                <form onSubmit={handleUpdateActivity}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Activity Name</label>
                        <input 
                            className="input-field" 
                            value={editingActivity.name}
                            onChange={e => setEditingActivity({...editingActivity, name: e.target.value})}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                         <input 
                            type="date"
                            className="input-field" 
                            value={editingActivity.date || ''}
                            onChange={e => setEditingActivity({...editingActivity, date: e.target.value})}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditingActivity(null)}>Cancel</button>
                        <button type="submit" className="btn">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* New Observation Modal */}
      {newObservation && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '400px', padding: '2rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>New Observation</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>For {newObservation.studentName}</p>
                
                <form onSubmit={handleSaveObservation}>
                    <div style={{ marginBottom: '1rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                         <input 
                            type="date"
                            className="input-field" 
                            value={newObservation.date}
                            onChange={e => setNewObservation({...newObservation, date: e.target.value})}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Observation</label>
                        <textarea 
                            className="input-field" 
                            rows="4"
                            value={newObservation.note}
                            onChange={e => setNewObservation({...newObservation, note: e.target.value})}
                            placeholder="Enter behavior or academic note..."
                            required
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setNewObservation(null)}>Cancel</button>
                        <button type="submit" className="btn">Save Note</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Add Attendance Date Modal */}
      {showAddDateModal && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '400px', padding: '2rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Add Attendance Date</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Select the date for the new column.</p>
                
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newAttendanceDate) {
                        if (students.length > 0) {
                             const s = students[0];
                             // Check if date already exists to avoid overwriting blindly (though overwrite with 'present' is mostly harmless for reset, let's just ensure we set it)
                             // Logic: Set first student to 'present' to initialize the column.
                             const updated = { ...s, attendance: { ...s.attendance, [newAttendanceDate]: 'present' } };
                             DataStore.updateStudent(updated);
                             refreshData();
                             setShowAddDateModal(false);
                         } else {
                             alert("Add students first to manage attendance.");
                             setShowAddDateModal(false);
                         }
                    }
                }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                         <input 
                            type="date"
                            className="input-field" 
                            value={newAttendanceDate}
                            onChange={e => setNewAttendanceDate(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn">Add Column</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Student Details Modal */}
      {viewingStudent && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Student Info</h3>
                    <button 
                        onClick={() => setIsEditingStudent(!isEditingStudent)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {isEditingStudent ? 'Cancel Edit' : 'Edit'}
                    </button>
                </div>
                
                {isEditingStudent ? (
                    <form onSubmit={handleUpdateStudentDetails}>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FULL NAME</label>
                                <input 
                                    className="input-field" 
                                    value={viewingStudent.name} 
                                    onChange={e => setViewingStudent({...viewingStudent, name: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                     <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>AGE</label>
                                     <input 
                                        className="input-field" 
                                        type="number"
                                        value={viewingStudent.age} 
                                        onChange={e => setViewingStudent({...viewingStudent, age: e.target.value})}
                                    />
                                </div>
                                <div>
                                     <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>VPS CODE</label>
                                     <input 
                                        className="input-field" 
                                        value={viewingStudent.vpsCode || ''} 
                                        onChange={e => setViewingStudent({...viewingStudent, vpsCode: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                 <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JORNADA</label>
                                 <select 
                                     className="input-field" 
                                     value={viewingStudent.jornada || 'Mañana'} 
                                     onChange={e => setViewingStudent({...viewingStudent, jornada: e.target.value})}
                                 >
                                     <option value="Mañana">Mañana</option>
                                     <option value="Tarde">Tarde</option>
                                 </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PARENT / GUARDIAN</label>
                                <input 
                                    className="input-field" 
                                    value={viewingStudent.parentName} 
                                    onChange={e => setViewingStudent({...viewingStudent, parentName: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PHONE</label>
                                    <input 
                                        className="input-field" 
                                        value={viewingStudent.parentPhone} 
                                        onChange={e => setViewingStudent({...viewingStudent, parentPhone: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PHONE 2</label>
                                    <input 
                                        className="input-field" 
                                        value={viewingStudent.parentPhone2 || ''} 
                                        onChange={e => setViewingStudent({...viewingStudent, parentPhone2: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>EMAIL</label>
                                <input 
                                    className="input-field" 
                                    type="email"
                                    value={viewingStudent.parentEmail || ''} 
                                    onChange={e => setViewingStudent({...viewingStudent, parentEmail: e.target.value})}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GENERAL OBSERVATIONS</label>
                                <textarea 
                                    className="input-field" 
                                    rows="3"
                                    value={viewingStudent.genericObs || ''} 
                                    onChange={e => setViewingStudent({...viewingStudent, genericObs: e.target.value})}
                                />
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsEditingStudent(false)}>Cancel Edit</button>
                            <button type="submit" className="btn">Save Changes</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FULL NAME</label>
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>{viewingStudent.name}</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                 <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>AGE</label>
                                 <p style={{ margin: 0 }}>{viewingStudent.age}</p>
                            </div>
                            <div>
                                 <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>VPS CODE</label>
                                 <p style={{ margin: 0 }}>{viewingStudent.vpsCode || '-'}</p>
                            </div>
                        </div>

                        <div>
                             <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JORNADA</label>
                             <p style={{ margin: 0 }}>{viewingStudent.jornada || 'Mañana'}</p>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PARENT / GUARDIAN</label>
                            <p style={{ margin: 0, fontWeight: 500 }}>{viewingStudent.parentName}</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PHONE</label>
                                <p style={{ margin: 0, color: 'var(--color-accent)' }}>{viewingStudent.parentPhone}</p>
                            </div>
                            {viewingStudent.parentPhone2 && (
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PHONE 2</label>
                                    <p style={{ margin: 0 }}>{viewingStudent.parentPhone2}</p>
                                </div>
                            )}
                        </div>
                        
                        {viewingStudent.parentEmail && (
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>EMAIL</label>
                                <p style={{ margin: 0 }}>{viewingStudent.parentEmail}</p>
                            </div>
                        )}

                        {viewingStudent.genericObs && (
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GENERAL OBSERVATIONS</label>
                                <p style={{ margin: 0, fontStyle: 'italic', background: '#f9f9f9', padding: '0.5rem', borderRadius: '6px' }}>
                                    {viewingStudent.genericObs}
                                </p>
                            </div>
                        )}
                        
                         <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setViewingStudent(null)}>Close</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}
