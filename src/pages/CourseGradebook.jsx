import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataStore } from '../services/DataStore';
import { Plus, Calendar, FileText, UserSquare2, ChevronLeft, Save, ArrowUpDown } from 'lucide-react';

export function CourseGradebook() {
  const { courseId } = useParams();
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('grades'); // grades, attendance, observer
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingActivity, setEditingActivity] = useState(null); // { id, name, date, courseId }
  const [newObservation, setNewObservation] = useState(null); // { studentId, studentName, date: '', note: '' }
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [newAttendanceDate, setNewAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [viewingStudent, setViewingStudent] = useState(null); // Student object to view details

  useEffect(() => {
    // Load data
    setStudents(DataStore.getStudentsByCourse(courseId));
    setActivities(DataStore.getActivities(courseId));
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
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else {
        // Sorting by grade (activity ID)
        valA = parseFloat(a.grades[sortConfig.key]) || -1; // Treat no grade as lowest
        valB = parseFloat(b.grades[sortConfig.key]) || -1;
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

  const deleteActivity = () => {
      if (confirm('Are you sure you want to delete this activity? All grades for it will be lost.')) {
          // Note: DataStore doesn't have deleteActivity yet, skipping for now or implementing if needed. 
          // User didn't strictly ask for delete, but "modify" usually implies management. 
          // Let's stick to modify for now to minimize scope creep unless easy.
          // Actually, I'll just close the modal.
          setEditingActivity(null);
      }
  }

  const handleGradeChange = (student, activityId, value) => {
    // Clone student to update state immediately for UI responsiveness
    const updatedStudent = { ...student, grades: { ...student.grades, [activityId]: value } };
    DataStore.updateStudent(updatedStudent);
    // No full refresh needed if we update local state, but for simplicity we can refresh or just mutate local list
    // Ideally we update the local `students` state to match
    setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  const calculateAverage = (student) => {
    const grades = Object.values(student.grades).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (grades.length === 0) return '-';
    const sum = grades.reduce((a, b) => a + b, 0);
    return (sum / grades.length).toFixed(1);
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
  // addAnnotation replaced by modal logic below

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ChevronLeft size={20} />
        </Link>
        <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>{courseId}</h1>
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
      </div>

      <div className="card" style={{ overflowX: 'auto', position: 'relative' }}>
        {activeTab === 'grades' && (
            <table style={{ width: '100%', minWidth: '800px' }}>
                <thead>
                    <tr>
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
                    {getSortedStudents().map(student => (
                        <tr key={student.id}>
                            <td style={{ fontWeight: 500 }}>{student.name}</td>
                            {activities.map(act => {
                                const grade = student.grades[act.id];
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
                            <th style={{ width: '250px' }}>Student Name</th>
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
                         {students.map(student => {
                             const dates = Array.from(new Set(students.flatMap(s => Object.keys(s.attendance || {})))).sort();
                             // Calculate totals
                             const counts = { present: 0, absent: 0, late: 0 };
                             Object.values(student.attendance || {}).forEach(status => {
                                 if (counts[status] !== undefined) counts[status]++;
                             });

                             return (
                                <tr key={student.id}>
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

        {activeTab === 'observer' && (
             <table>
                <thead>
                    <tr>
                        <th style={{ width: '200px' }}>Student Name</th>
                        <th>Observations</th>
                        <th style={{ width: '100px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(student => (
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
                                            <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>{note}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: '#ccc', fontStyle: 'italic' }}>No observations.</span>
                                )}
                            </td>
                            <td style={{ verticalAlign: 'top' }}>
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
            <div className="card" style={{ width: '400px', padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Student Details</h3>
                
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

                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CONTACT PHONE</label>
                        <p style={{ margin: 0, color: 'var(--color-accent)' }}>{viewingStudent.parentPhone}</p>
                    </div>

                    {viewingStudent.genericObs && (
                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GENERAL OBSERVATIONS</label>
                            <p style={{ margin: 0, fontStyle: 'italic', background: '#f9f9f9', padding: '0.5rem', borderRadius: '6px' }}>
                                {viewingStudent.genericObs}
                            </p>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={() => setViewingStudent(null)}>Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
