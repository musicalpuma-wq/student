import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DataStore } from '../services/DataStore';
import { Plus, Calendar, FileText, UserSquare2, ChevronLeft, Save, ArrowUpDown, Mail, GripVertical, Edit2, ArrowRight, Trash2, AlertTriangle, KeyRound, Lock, Unlock } from 'lucide-react';
import { GenericModal } from '../components/GenericModal';
import { useSettings } from '../context/SettingsContext';

export function CourseGradebook() {
  const { courseId } = useParams();
  const { t } = useSettings();
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


  
  // Delete Course State
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [deleteCourseInput, setDeleteCourseInput] = useState('');
  const [deleteTimer, setDeleteTimer] = useState(30);

  const [deleteCourseCanType, setDeleteCourseCanType] = useState(false);

  // Security Code State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [onSecuritySuccess, setOnSecuritySuccess] = useState(null); // Function to call on success
  const [securityActionName, setSecurityActionName] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: () => {} });

  const showModal = (config) => setModalConfig({ ...config, isOpen: true });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const navigate = useNavigate();

  useEffect(() => {
    // Load data
    const loadedStudents = DataStore.getStudentsByCourse(courseId);
    setStudents(loadedStudents);
    setActivities(DataStore.getActivities(courseId));
    setMaterials(DataStore.getMaterials(courseId));

    // Automated Observation Check
    let hasChanges = false;
    const pendingEmailNote = "Pendiente de correo electrónico de acudiente";
    const pendingPhoneNote = "No ha proporcionado número telefónico del acudiente";
    const today = new Date().toISOString().split('T')[0];

    const updatedStudents = loadedStudents.map(s => {
        let annotations = [...(s.annotations || [])];
        let wasUpdated = false;

        // Check Email
        if (s.parentEmail === 'pending@pending.co') {
             if (!annotations.some(note => note.includes(pendingEmailNote))) {
                 annotations.push(`[${today}] ${pendingEmailNote}`);
                 wasUpdated = true;
             }
        }

        // Check Phone
        if (!s.parentPhone || s.parentPhone === 'Pending' || s.parentPhone.trim() === '') {
             if (!annotations.some(note => note.includes(pendingPhoneNote))) {
                 annotations.push(`[${today}] ${pendingPhoneNote}`);
                 wasUpdated = true;
             }
        }

        if (wasUpdated) {
             hasChanges = true;
             const updatedS = { ...s, annotations };
             DataStore.updateStudent(updatedS); // Update persistent store immediately
             return updatedS;
        }
        return s;
    });

    if (hasChanges) {
        setStudents(updatedStudents); // Update local state if we added notes
    }

  }, [courseId, refreshTrigger]);

  // Delete Course Timer Logic
  useEffect(() => {
    let interval;
    if (showDeleteCourseModal && deleteTimer > 0) {
      interval = setInterval(() => {
        setDeleteTimer(prev => prev - 1);
      }, 1000);
    } else if (deleteTimer === 0) {
        setDeleteCourseCanType(true);
    }
    return () => clearInterval(interval);
  }, [showDeleteCourseModal, deleteTimer]);

  const handleStrictDeleteCourse = (e) => {
      e.preventDefault();
      if (deleteCourseInput === "I'm sure I want to delete this course") {
          DataStore.deleteCourse(courseId);
          navigate('/');
      }
  };

  const openDeleteModal = () => {
      setDeleteCourseInput('');
      setDeleteTimer(30);
      setDeleteCourseCanType(false);
      setShowDeleteCourseModal(true);
  };

  const requestSecurityCheck = (actionName, onSuccess) => {
      setSecurityActionName(actionName);
      setOnSecuritySuccess(() => onSuccess); // Wrap in function to ensure state holds the function reference
      setSecurityCodeInput('');
      setShowSecurityModal(true);
  };

  const handleSecuritySubmit = (e) => {
      e.preventDefault();
      if (securityCodeInput === '6251') {
          if (onSecuritySuccess) onSecuritySuccess();
          setShowSecurityModal(false);
          setSecurityCodeInput('');
      } else {
          alert("Incorrect security code.");
      }
  };

  /* Helper to parse "date note" format */
  const parseObservation = (obsString) => {
    // Expected format: "[2025-01-28] content..."
    const match = obsString.match(/^\[(.*?)]\s*(.*)$/);
    if (match) {
      return { date: match[1], note: match[2] };
    }
    return { date: '', note: obsString };
  };

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
    let filtered = [...students];

    filtered.sort((a, b) => {
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
    return filtered;
  };

  // --- Grades Logic ---
  const handleAddActivity = () => {
    showModal({
        type: 'prompt',
        title: t('addActivity'),
        inputPlaceholder: t('enterActivityName'),
        onConfirm: (name) => {
            if (name) {
                DataStore.addActivity(courseId, name);
                refreshData();
                closeModal();
            }
        },
        onCancel: closeModal
    });
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
             
             let updatedAnnotations = [...(student.annotations || [])];
             
             if (newObservation.index !== undefined && newObservation.index !== null) {
                 // Edit existing
                 updatedAnnotations[newObservation.index] = newAnnotation;
             } else {
                 // Add new
                 updatedAnnotations.push(newAnnotation);
             }

             const updatedStudent = { 
                  ...student, 
                  annotations: updatedAnnotations
              };
              DataStore.updateStudent(updatedStudent);
              // Update local state
              setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
          }
          setNewObservation(null);
      }
  };

  const handleEditObservation = (student, index) => {
      const obsString = student.annotations[index];
      const parsed = parseObservation(obsString);
      setNewObservation({
          studentId: student.id,
          studentName: student.name,
          date: parsed.date,
          note: parsed.note,
          index: index // Track index for updating
      });
  };

  const handleDeleteObservation = (student, index) => {
      const deleteObs = () => {
          const updatedAnnotations = student.annotations.filter((_, i) => i !== index);
          const updatedStudent = { 
              ...student, 
              annotations: updatedAnnotations 
          };
          DataStore.updateStudent(updatedStudent);
          setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
      };
      
      requestSecurityCheck("delete this observation", deleteObs);
  };

  const handleDeleteStudent = (student) => {
      requestSecurityCheck(`delete student ${student.name}`, () => {
          const success = DataStore.deleteStudent(student.id);
          if (success) {
              setStudents(prev => prev.filter(s => s.id !== student.id));
              if (viewingStudent && viewingStudent.id === student.id) {
                  setViewingStudent(null);
              }
              refreshData(); // Force full refresh to be safe
          }
      });
  };

  const handleMoveStudent = (student) => {
      // Simple prompt for now, or a custom modal if preferred. 
      // User asked: "Opción de cambiar a un estudiante de curso"
      // Let's get list of available courses to show in prompt? No, prompt is text.
      // Better: Use a confirm or prompt. 
      const availableCourses = DataStore.getCourses().filter(c => c !== courseId);
      if (availableCourses.length === 0) {
          showModal({
              type: 'alert',
              title: 'No Available Courses',
              message: "There are no other courses to move the student to.",
              onConfirm: closeModal,
              onCancel: closeModal
          });
          return;
      }
      
          
      showModal({
          type: 'prompt',
          title: 'Move Student',
          message: `Available courses: ${availableCourses.join(', ')}`,
          inputPlaceholder: 'Target Course Name',
          onConfirm: (targetCourse) => {
              if (targetCourse && availableCourses.includes(targetCourse)) {
                  closeModal();
                  requestSecurityCheck(`move ${student.name} to ${targetCourse}`, () => {
                      const newJornada = targetCourse.includes('JT') ? 'Tarde' : 'Mañana';
                      const updatedStudent = { ...student, course: targetCourse, jornada: newJornada };
                      DataStore.updateStudent(updatedStudent);
                      setStudents(prev => prev.filter(s => s.id !== student.id));
                      if (viewingStudent && viewingStudent.id === student.id) {
                          setViewingStudent(null);
                      }
                  });
              } else if (targetCourse) {
                   closeModal();
                   // confirm creation
                   setTimeout(() => { // delay for modal transition
                       showModal({
                           type: 'confirm',
                           title: 'Course Not Found',
                           message: `Course '${targetCourse}' does not exist. Create it and move student?`,
                           onConfirm: () => {
                                closeModal();
                                requestSecurityCheck(`create course ${targetCourse} and move ${student.name}`, () => {
                                    const newJornada = targetCourse.includes('JT') ? 'Tarde' : 'Mañana';
                                    const updatedStudent = { ...student, course: targetCourse, jornada: newJornada };
                                    DataStore.updateStudent(updatedStudent);
                                    DataStore.addCourse(targetCourse); 
                                    setStudents(prev => prev.filter(s => s.id !== student.id));
                                    if (viewingStudent && viewingStudent.id === student.id) {
                                        setViewingStudent(null);
                                    }
                                });
                           },
                           onCancel: closeModal
                       });
                   }, 300);
              }
          },
          onCancel: closeModal
      });
  };


  // --- Materials Logic ---
  const handleAddMaterial = () => {
    showModal({
        type: 'prompt',
        title: t('addMaterial'),
        inputPlaceholder: t('materialName'),
        onConfirm: (name) => {
            if (name) {
                DataStore.addMaterialColumn(courseId, name);
                refreshData();
                closeModal();
            }
        },
        onCancel: closeModal
    });
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

  const handleVPSChange = (student, newVPS) => {
      const updatedStudent = { ...student, vpsCode: newVPS };
      DataStore.updateStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  // --- Observer Logic ---
  const handleSendToParent = (student, note) => {
      if (!student.parentEmail) {
          showModal({
              type: 'alert',
              title: 'No Email Found',
              message: 'No parent email registered for this student. Observation copied to clipboard.',
              onConfirm: closeModal,
              onCancel: closeModal
          });
          const text = `Student: ${student.name}\nObservation: ${note}`;
          navigator.clipboard.writeText(text);
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

  const handleDeleteActivity = (activity) => {
      requestSecurityCheck(`delete activity "${activity.name}"`, () => {
           DataStore.deleteActivity(courseId, activity.id);
           setEditingActivity(null);
           refreshData();
      });
  };

  const handleDeleteAttendance = (date) => {
      requestSecurityCheck(`delete attendance for ${date}`, () => {
           DataStore.deleteAttendanceColumn(courseId, date);
           refreshData(); // Force refresh to update students list from store
           // Note: DataStore.deleteAttendanceColumn updates local storage, refreshData triggers re-read via useEffect
      });
  };

  const handleToggleLockActivity = (activity) => {
      if (activity.locked) {
          // Unlock -> Require Security
          requestSecurityCheck(`unlock activity "${activity.name}"`, () => {
               DataStore.updateActivity(courseId, { ...activity, locked: false });
               refreshData();
          });
      } else {
          // Lock -> Immediate
          showModal({
              type: 'confirm',
              title: 'Lock Activity?',
              message: `Are you sure you want to lock "${activity.name}"? Grades will become read-only.`,
              onConfirm: () => {
                   DataStore.updateActivity(courseId, { ...activity, locked: true });
                   refreshData();
                   closeModal();
              },
              onCancel: closeModal
          });
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
                    <button 
                        onClick={() => requestSecurityCheck("delete this course", openDeleteModal)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px', marginLeft: '0.5rem' }}
                        title="Delete Course"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            )}
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('courseManagement')}</p>
        </div>
      </div>
      
      {/* Course Statistics Header */}
      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '1rem', 
          marginBottom: '2rem',
          padding: '1rem',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)'
      }}>
          {(() => {
              const studentsList = students || [];
              const totalStudents = studentsList.length;
              
              // Total Observations
              const totalObs = studentsList.reduce((acc, s) => acc + (s.annotations ? s.annotations.length : 0), 0);
              
              // Graded Activities
              const totalActivities = activities.length;
              
              // Compliance %
              // Definition: (Percentage of students who presented the activity / Total students) * Total activities... wait.
              // Logic requested: "percentage of students who have a grade (cell not empty) against total students"
              // "Example if there are 2 grades, and of 25 students, 1st grade has 20, 2nd has 15. Total notes = 35. Total possible = 50. Compliance = 70%."
              let totalPossibleGrades = totalStudents * totalActivities;
              let actualGradesCount = 0;
              let sumGrades = 0;
              
              studentsList.forEach(s => {
                  activities.forEach(a => {
                      const g = (s.grades || {})[a.id];
                      // Check if empty
                      if (g !== undefined && g !== null && g !== '') {
                          actualGradesCount++;
                          const val = parseFloat(g);
                          if (!isNaN(val)) sumGrades += val;
                      } else {
                          // Empty cells count as 1.0 for Average calculation per user request
                          // "las casillas vacías tómalas como un '1,0' ya que es la nota más baja posible"
                          sumGrades += 1.0; 
                      }
                  });
              });
              
              const compliance = totalPossibleGrades > 0 
                  ? Math.round((actualGradesCount / totalPossibleGrades) * 100) 
                  : 0;

              // General Course Average
              // Average = Sum of all grades (treating empty as 1.0) / Total possible grades
              const average = totalPossibleGrades > 0 
                  ? (sumGrades / totalPossibleGrades).toFixed(2)
                  : '-';
                  
              return (
                  <>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('students')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalStudents}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('tabObserver')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalObs}</div>
                    </div>
                     <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Activities</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalActivities}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('compliance')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: compliance < 70 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {compliance}%
                        </div>
                    </div>
                     <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('courseAvg')}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{average}</div>
                    </div>
                  </>
              );
          })()}
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
            {t('tabGrades')}
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
            {t('tabAttendance')}
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
            {t('tabObserver')}
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
            {t('tabMaterials')}
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
                                {t('vps')}
                                <ArrowUpDown size={14} color={sortConfig.key === 'vps' ? 'var(--color-accent)' : '#ccc'} />
                            </div>
                        </th>
                        <th 
                            style={{ width: '250px', cursor: 'pointer' }}
                            onClick={() => handleSort('name')}
                            className="hover-bg-gray"
                        >
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {t('studentName')}
                                <ArrowUpDown size={14} color={sortConfig.key === 'name' ? 'var(--color-accent)' : '#ccc'} />
                            </div>
                        </th>
                        {activities.map(act => (
                            <th 
                                key={act.id} 
                                style={{ minWidth: '100px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', background: act.locked ? '#fdfdfd' : 'transparent' }}
                                className="hover-bg-gray"
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'space-between' }}>
                                    
                                    {/* Lock Icon - Centered */}
                                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '2px' }}>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleToggleLockActivity(act); }}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                color: act.locked ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                                                padding: '2px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title={act.locked ? "Locked (Click to Unlock)" : "Unlocked (Click to Lock)"}
                                        >
                                            {act.locked ? <Lock size={14} /> : <Unlock size={14} />}
                                        </button>
                                    </div>
                                    
                                    {/* Content Group */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        {/* Date */}
                                        <div 
                                            onClick={() => !act.locked && setEditingActivity(act)}
                                            title={act.locked ? "Locked" : "Click to edit details"}
                                            style={{ 
                                                fontSize: '0.7rem', 
                                                color: 'var(--color-text-secondary)', 
                                                fontWeight: 500, 
                                                opacity: act.locked ? 0.7 : 1,
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {act.date || 'Set Date'}
                                        </div>

                                        {/* Name (Truncated) */}
                                        <div 
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '4px', 
                                                opacity: act.locked ? 0.7 : 1,
                                                fontSize: '0.85rem',
                                                fontWeight: 600
                                            }}
                                            onClick={() => handleSort(act.id)}
                                            title={act.name} // Full name on hover
                                        >
                                            {act.name.length > 10 ? `${act.name.substring(0, 10)}...` : act.name}
                                            <ArrowUpDown size={12} color={sortConfig.key === act.id ? 'var(--color-accent)' : '#ccc'} />
                                        </div>
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
                        <th style={{ width: '100px', textAlign: 'center', color: 'var(--color-text-primary)' }}>{t('finalGrade')}</th>
                    </tr>
                </thead>
                <tbody>
                    {getSortedStudents().map((student, index) => (
                        <tr key={student.id}>
                            <td style={{ textAlign: 'center', color: '#86868b', fontSize: '0.9rem' }}>{index + 1}</td>
                            <td style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', padding: 0 }}>
                                <input 
                                    className="input-field-transparent"
                                    value={student.vpsCode || ''}
                                    onChange={(e) => handleVPSChange(student, e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        border: '1px solid transparent', 
                                        background: 'transparent',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-secondary)',
                                        textAlign: 'center'
                                    }}
                                    placeholder="-"
                                />
                            </td>
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
                                            disabled={act.locked}
                                            readOnly={act.locked}
                                            title={act.locked ? "This column is locked." : ""}
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
                         {t('addDate')}
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
                                <th key={date} style={{ textAlign: 'center', minWidth: '80px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        {date.split('-').slice(1).join('/')}
                                        <button 
                                            onClick={() => handleDeleteAttendance(date)}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                color: 'var(--color-danger)', 
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title={`Delete attendance for ${date}`}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th style={{ textAlign: 'center', color: 'var(--color-success)', width: '40px' }} title="Present">P</th>
                            <th style={{ textAlign: 'center', color: 'var(--color-danger)', width: '40px' }} title="Absent">A</th>
                            <th style={{ textAlign: 'center', color: 'var(--color-warning)', width: '40px' }} title="Late">L</th>
                        </tr>
                    </thead>
                    <tbody>

                         {getSortedStudents().map((student, index) => {
                             const dates = Array.from(new Set(students.flatMap(s => Object.keys(s.attendance || {})))).sort();
                             // Calculate totals
                             const counts = { present: 0, absent: 0, late: 0 };
                             Object.values(student.attendance || {}).forEach(status => {
                                 if (counts[status] !== undefined) counts[status]++;
                             });

                             return (
                                <tr key={student.id}>
                                    <td style={{ textAlign: 'center', color: '#86868b', fontSize: '0.9rem' }}>{index + 1}</td>
                                    <td style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', padding: 0 }}>
                                        <input 
                                            className="input-field-transparent"
                                            value={student.vpsCode || ''}
                                            onChange={(e) => handleVPSChange(student, e.target.value)}
                                            style={{ 
                                                width: '100%', 
                                                border: '1px solid transparent', 
                                                background: 'transparent',
                                                fontSize: '0.9rem',
                                                color: 'var(--color-text-secondary)',
                                                textAlign: 'center'
                                            }}
                                            placeholder="-"
                                        />
                                    </td>
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
                                                    // Logic: null/undefined -> 'present' -> 'absent' -> 'late' -> null
                                                    let next = 'present';
                                                    if (status === 'present') next = 'absent';
                                                    else if (status === 'absent') next = 'late';
                                                    else if (status === 'late') next = null; // Back to initial/null
                                                    
                                                    const updated = { ...student };
                                                    if (!updated.attendance) updated.attendance = {};
                                                    
                                                    if (next) {
                                                        updated.attendance[date] = next;
                                                    } else {
                                                        delete updated.attendance[date];
                                                    }
                                                    
                                                    DataStore.updateStudent(updated);
                                                    setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
                                                }}
                                            >
                                                <div style={{ 
                                                    width: '12px', 
                                                    height: '12px', 
                                                    borderRadius: '50%', 
                                                    background: !status ? 'white' : dotColor,
                                                    border: !status ? '1px solid #ccc' : 'none',
                                                    margin: '0 auto'
                                                }} title={status || 'Not Taken'} />
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
                            {t('vps')}
                         </th>
                         <th 
                            style={{ width: '250px', cursor: 'pointer' }}
                            onClick={() => handleSort('name')}
                         >
                            {t('studentName')}
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
                            <td style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', padding: 0 }}>
                                  <input 
                                    className="input-field-transparent"
                                    value={student.vpsCode || ''}
                                    onChange={(e) => handleVPSChange(student, e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        border: '1px solid transparent', 
                                        background: 'transparent',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-secondary)',
                                        textAlign: 'center'
                                    }}
                                    placeholder="-"
                                />
                            </td>
                            <td style={{ fontWeight: 500 }}>{student.name}</td>
                            {materials.map(mat => (
                                <td key={mat.id} style={{ padding: '0.5rem' }}>
                                    <input 
                                        className="input-field"
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                        placeholder={t('assign') || "Assign..."}
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
                                {t('studentName')}
                                {sortConfig.key === 'name' && <ArrowUpDown size={14} />}
                            </div>
                        </th>
                        <th>{t('observations') || "Observations"}</th>
                        <th style={{ width: '100px' }}>{t('action') || "Action"}</th>
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
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                                    <span>{note}</span>
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button 
                                                            style={{ 
                                                                background: 'none', 
                                                                border: 'none', 
                                                                cursor: 'pointer', 
                                                                color: 'var(--color-text-secondary)',
                                                                padding: '4px'
                                                            }}
                                                            title="Edit"
                                                            onClick={() => handleEditObservation(student, i)}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                         <button 
                                                            style={{ 
                                                                background: 'none', 
                                                                border: 'none', 
                                                                cursor: 'pointer', 
                                                                color: 'var(--color-danger)',
                                                                padding: '4px'
                                                            }}
                                                            title="Delete"
                                                            onClick={() => handleDeleteObservation(student, i)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <button 
                                                            style={{ 
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
                                                                fontWeight: 500,
                                                                marginLeft: '4px'
                                                            }}
                                                            title="Send to Parent via Email"
                                                            onClick={() => handleSendToParent(student, note)}
                                                        >
                                                            <Mail size={14} />
                                                            Send to parent
                                                            <ArrowRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
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
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                         <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            onClick={() => handleDeleteActivity(editingActivity)}
                        >
                            <Trash2 size={16} style={{ marginRight: '6px' }}/> Delete
                        </button>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditingActivity(null)}>Cancel</button>
                            <button type="submit" className="btn">Save Changes</button>
                        </div>
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
                <h3 style={{ marginBottom: '0.5rem' }}>
                    {newObservation.index !== undefined ? 'Edit Observation' : 'New Observation'}
                </h3>
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={() => handleMoveStudent(viewingStudent)}
                            className="btn btn-secondary"
                            title="Move Student"
                            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <ArrowRight size={16} /> Move
                        </button>
                        <button 
                            onClick={() => handleDeleteStudent(viewingStudent)}
                            className="btn btn-secondary"
                            title="Delete Student"
                            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                        <button 
                            onClick={() => setIsEditingStudent(!isEditingStudent)}
                            style={{ border: 'none', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600, marginLeft: '8px' }}
                        >
                            {isEditingStudent ? 'Cancel Edit' : 'Edit'}
                        </button>
                    </div>
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
                                     <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DATE OF BIRTH</label>
                                     <input 
                                        className="input-field" 
                                        type="date"
                                        value={viewingStudent.birthDate || ''} 
                                        onChange={e => {
                                            const dob = e.target.value;
                                            // Recalculate age immediately for UI
                                            const birthDate = new Date(dob);
                                            const diffMs = Date.now() - birthDate.getTime();
                                            const ageDate = new Date(diffMs); 
                                            const newAge = Math.abs(ageDate.getUTCFullYear() - 1970);
                                            
                                            setViewingStudent({...viewingStudent, birthDate: dob, age: newAge});
                                        }}
                                    />
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                        Age: {viewingStudent.age}
                                    </div>
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
                                     disabled // Locked
                                     style={{ backgroundColor: '#f5f5f7', color: '#888' }}
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

       {/* Security Modal */}
      {showSecurityModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
               <KeyRound size={24} />
               <h3 style={{ margin: 0 }}>Security Check</h3>
            </div>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
                Please enter the security code to <strong>{securityActionName}</strong>.
            </p>
            <form onSubmit={handleSecuritySubmit} autoComplete="off">
                <input 
                    type="password" 
                    name="action_security_code_unique_v1"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Security Code"
                    value={securityCodeInput}
                    onChange={(e) => setSecurityCodeInput(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem' }}
                />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowSecurityModal(false)}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        Confirm
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Strict Delete Course Modal */}
       {showDeleteCourseModal && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100, // Higher than other modals
            backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '450px', padding: '2rem', border: '1px solid var(--color-danger)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--color-danger)', marginBottom: '1rem' }}>
                    <AlertTriangle size={32} />
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Danger Zone</h2>
                </div>
                
                <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Are you absolutely sure you want to delete the course "{courseId}"?</p>
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    This action is <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>IRREVERSIBLE</span>. 
                    All students, grades, attendance records, and observations associated with this course will be permanently deleted.
                </p>

                <div style={{ 
                    background: '#f5f5f7', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                    fontWeight: 600
                }}>
                    {deleteTimer > 0 ? (
                        <span style={{ color: 'var(--color-text-secondary)' }}>Please wait {deleteTimer} seconds...</span>
                    ) : (
                         <span style={{ color: 'var(--color-success)' }}>Verification enabled.</span>
                    )}
                </div>

                <form onSubmit={handleStrictDeleteCourse}>
                     <div style={{ marginBottom: '1.5rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                             Type "I'm sure I want to delete this course"
                         </label>
                         <input 
                            className="input-field" 
                            style={{ width: '100%', borderColor: deleteCourseInput === "I'm sure I want to delete this course" ? 'var(--color-danger)' : '' }}
                            value={deleteCourseInput}
                            onChange={e => setDeleteCourseInput(e.target.value)}
                            disabled={!deleteCourseCanType}
                            placeholder={!deleteCourseCanType ? "Waiting for timer..." : "Type the confirmation phrase"}
                            onPaste={(e) => e.preventDefault()} // Prevent pasting for strictness
                            autoComplete="off"
                        />
                     </div>
                     <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                         <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setShowDeleteCourseModal(false)}
                         >
                            Cancel
                        </button>
                         <button 
                            type="submit" 
                            className="btn"
                            style={{ 
                                background: 'var(--color-danger)', 
                                opacity: (deleteCourseInput === "I'm sure I want to delete this course") ? 1 : 0.5,
                                cursor: (deleteCourseInput === "I'm sure I want to delete this course") ? 'pointer' : 'not-allowed'
                            }}
                            disabled={deleteCourseInput !== "I'm sure I want to delete this course"}
                         >
                            Delete Course
                         </button>
                     </div>
                </form>
            </div>
        </div>
      )}


      {/* Security Check Modal */}
      {showSecurityModal && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200, // Topmost
            backdropFilter: 'blur(3px)'
        }}>
            <div className="card" style={{ width: '350px', padding: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                        <KeyRound size={32} color="var(--color-text-secondary)" />
                    </div>
                    <h3 style={{ margin: 0 }}>Security Check</h3>
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                        Enter code to {securityActionName}
                    </p>
                </div>
                
                <form onSubmit={handleSecuritySubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <input 
                            type="password"
                            className="input-field" 
                            style={{ width: '100%', textAlign: 'center', letterSpacing: '4px', fontSize: '1.5rem' }}
                            placeholder="CODE"
                            value={securityCodeInput}
                            onChange={e => setSecurityCodeInput(e.target.value)}
                            autoFocus
                            maxLength={4}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSecurityModal(false)}>Cancel</button>
                        <button type="submit" className="btn" style={{ flex: 1 }}>Verify</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      <GenericModal 
          isOpen={modalConfig.isOpen}
          type={modalConfig.type}
          title={modalConfig.title}
          message={modalConfig.message}
          onConfirm={modalConfig.onConfirm}
          onCancel={modalConfig.onCancel}
          inputPlaceholder={modalConfig.inputPlaceholder}
          defaultValue={modalConfig.defaultValue}
      />
    </div>
  );
}
