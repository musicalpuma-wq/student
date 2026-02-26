import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Clock, User, UserSquare2, FileText, ChevronRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Dashboard() {
  const navigate = useNavigate();
  const { settings, t } = useSettings();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalCourses: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // Create Course State
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseGrade, setNewCourseGrade] = useState('');
  const [newCourseJornada, setNewCourseJornada] = useState('JM'); // JM or JT
  const [newCourseDirector, setNewCourseDirector] = useState('');
  const [newCourseSchedule, setNewCourseSchedule] = useState('');

  useEffect(() => {
    // Check if we need to seed data
    const students = DataStore.getStudents();
    if (students.length === 0) {
      // Auto-seed for demo purposes if empty
      console.log("Seeding mock data...");
      DataStore.seedMockData();
    }
    
    // Load data
    const courseList = DataStore.getCourses();
    setCourses(courseList);
    setStats({
      totalStudents: DataStore.getStudents().length,
      totalCourses: courseList.length
    });
  }, []);

  const calculateCourseStats = (courseName) => {
      const students = DataStore.getStudentsByCourse(courseName);
      if (students.length === 0) return { avg: "0.0", failing: 0 };

      const studentAverages = students.map(s => {
          const grades = Object.values(s.grades).map(v => parseFloat(v)).filter(v => !isNaN(v));
          // If no grades, we treat as 0 or ignore? User said empty cells = 1.0 in Gradebook, 
          // but for general stats maybe we only count graded ones?
          // Let's stick to the logic used in Gradebook: empty/missing = 1.0 if we are strictly calculating course performance?
          // Actually, in dashboard usually we want "current standing". 
          // Let's use the average of existing grades.
          if (grades.length === 0) return null;
          return grades.reduce((a, b) => a + b, 0) / grades.length;
      }).filter(a => a !== null);

      if (studentAverages.length === 0) return { avg: "0.0", failing: 0 };

      const courseAvg = studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length;
      const failingCount = studentAverages.filter(a => a < 3.0).length;

      return { avg: courseAvg.toFixed(1), failing: failingCount };
  };

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
        const allStudents = DataStore.getStudents();
        const results = allStudents.filter(s => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (s.vpsCode && s.vpsCode.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setSearchResults(results.slice(0, 5)); // Limit to 5
    } else {
        setSearchResults([]);
    }
  }, [searchQuery]);

  const handleCreateCourse = (e) => {
      e.preventDefault();
      if (newCourseGrade && newCourseJornada) {
          const courseName = `${newCourseGrade}-${newCourseJornada}`;
          const success = DataStore.addCourse(courseName, {
              director: newCourseDirector,
              schedule: newCourseSchedule
          });
          
          if (success) {
              setCourses(DataStore.getCourses());
              setStats({
                  totalStudents: DataStore.getStudents().length,
                  totalCourses: DataStore.getCourses().length
              });
              setShowCreateCourseModal(false);
              setNewCourseGrade('');
              setNewCourseJornada('JM');
              setNewCourseDirector('');
              setNewCourseSchedule('');
              alert(`Course ${courseName} created successfully!`);
          } else {
              alert(`Course ${courseName} already exists.`);
          }
      }
  };

  return (
    <div>
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
            <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>Dashboard</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
             {/* Quick Course Access */}
             <div style={{ minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Quick Access
                </label>
                <select 
                    onChange={(e) => {
                        if (e.target.value) navigate(`/course/${e.target.value}`);
                    }}
                    style={{ 
                        width: '100%', 
                        padding: '0.6rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--color-border)',
                        fontSize: '0.9rem',
                        background: 'white',
                         cursor: 'pointer'
                    }}
                    defaultValue=""
                >
                    <option value="" disabled>Select Course...</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>

            {/* Student Search */}
            <div style={{ minWidth: '250px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Quick Search
                </label>
                <input 
                    type="text"
                    placeholder="Search Student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '0.6rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--color-border)',
                        fontSize: '0.9rem'
                    }}
                />
                {searchResults.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        zIndex: 10
                    }}>
                        {searchResults.map(s => (
                            <div 
                                key={s.id}
                                onClick={() => navigate(`/course/${s.course}`)}
                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                            >
                                <div style={{ fontWeight: 500 }}>{s.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.course} • {s.vpsCode || '-'}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </header>
      
      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.8rem', background: 'var(--color-bg-secondary)', color: 'var(--color-success)', borderRadius: '50%' }}>
            <UserSquare2 size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('totalStudents')}</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.totalStudents}</p>
          </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.8rem', background: 'var(--color-bg-secondary)', color: 'var(--color-accent)', borderRadius: '50%' }}>
            <FileText size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('totalCourses')}</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.totalCourses}</p>
          </div>
        </div>
      </div>
      
      {/* Performance Chart */ }
      {courses.length > 0 && (
          <div className="card" style={{ marginBottom: '3rem', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>{t('coursePerformance')}</h3>
              <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  gap: '2rem', 
                  height: '280px', /* Increased height slightly for the mascots */
                  overflowX: 'auto',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--color-border)',
                  paddingTop: '2rem'
              }}>
                  {courses.map((course, idx) => {
                      const stats = calculateCourseStats(course);
                      const avg = parseFloat(stats.avg);
                      // Scale: 1.0 to 5.0
                      // y = (val - 1) / (5 - 1) * 100
                      const heightPercent = Math.max(0, Math.min(((avg - 1) / 4) * 100, 100)); // Normalize 1-5 to 0-100%
                      
                      const finalBg = avg < 3.0 
                          ? 'var(--color-danger)' 
                          : 'var(--color-success)';

                      let emojiFace = '';
                      let questionMarks = null;
                      
                      if (avg >= 4.5) {
                          emojiFace = '🤩'; 
                      } else if (avg >= 3.5) {
                          emojiFace = '😁'; 
                      } else if (avg >= 3.0) {
                          emojiFace = '😐'; 
                      } else if (avg >= 2.0) {
                          emojiFace = '😢'; 
                          questionMarks = <span style={{ position: 'absolute', top: '-15px', right: '-10px', fontSize: '1.2rem', color: 'red', fontWeight: 'bold', animation: 'mascot-float 1s infinite', zIndex: 10 }}>❓❓</span>;
                      } else {
                          emojiFace = '😡'; 
                      }

                      return (
                          <div key={course} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '40px', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                               {questionMarks}
                               <div className="mascot-excellent" style={{
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'center',
                                   width: '42px',
                                   height: '42px',
                                   fontSize: '2rem',
                                   background: 'white',
                                   borderRadius: '50%',
                                   boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                   marginBottom: '-8px',
                                   zIndex: 2,
                                   border: `2px solid var(--color-bg-card)`
                               }}>
                                   {emojiFace}
                               </div>
                               <div style={{ 
                                   fontWeight: 700, 
                                   fontSize: '0.8rem', 
                                   color: finalBg,
                                   zIndex: 3,
                                   textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                               }}>
                                   {stats.avg}
                               </div>
                               <div 
                                  className="animate-bar"
                                  style={{ 
                                      width: '30px', 
                                      height: `${heightPercent}%`, 
                                      background: finalBg,
                                      borderRadius: '4px 4px 0 0',
                                      opacity: 0.9,
                                      minHeight: '4px', // Visibility for 1.0
                                      animationDelay: `${idx * 0.1}s`, // Staggered entrance
                                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)',
                                      position: 'relative'
                                  }} 
                                  title={`${course}: ${stats.avg}`}
                               >
                                   {/* Shiny effect on the bar */}
                                   <div style={{
                                       position: 'absolute',
                                       top: 0, left: 0, right: 0, bottom: 0,
                                       background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)',
                                       borderRadius: 'inherit'
                                   }} />
                               </div>
                               <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                                   {course}
                               </div>
                          </div>
                      );
                  })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                  <span>1.0</span>
                  <span>5.0</span>
              </div>
          </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Your Courses</h3>
        <button 
            onClick={() => setShowCreateCourseModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
            <Plus size={18} /> New Course
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {courses.map(course => {
            const studentCount = DataStore.getStudentsByCourse(course).length;
            const { avg, failing } = calculateCourseStats(course);
            const numAvg = parseFloat(avg);
            const courseDetails = DataStore.getCourseDetails(course);
            
            // Percentage for pie
            const percentage = (numAvg / 5) * 100;
            const chartColor = numAvg < 3.0 ? 'var(--color-danger)' : 'var(--color-success)';
            
            return (
              <Link 
                to={`/course/${course}`} 
                key={course} 
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card" style={{ 
                  height: '100%',
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ 
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem', 
                          background: '#f5f5f7', 
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          marginBottom: '0.5rem',
                          color: 'black' // Force black text for contrast
                        }}>
                          Course
                        </div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.2rem' }}>{course}</h2>
                        
                        <div style={{ marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                            {courseDetails.director && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Director">
                                    <User size={14} /> {courseDetails.director}
                                </div>
                            )}
                            {courseDetails.schedule && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }} title="Schedule">
                                    <Clock size={14} /> {courseDetails.schedule}
                                </div>
                            )}
                        </div>
                        
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{studentCount} Students</p>
                      </div>
                      
                      {/* Mini Pie Chart for Average */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              background: `conic-gradient(${chartColor} 0% ${percentage}%, #e5e5ea ${percentage}% 100%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '0.3rem'
                          }}>
                              <div style={{
                                  width: '42px',
                                  height: '42px',
                                  borderRadius: '50%',
                                  background: 'var(--color-bg-card)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.9rem',
                                  fontWeight: 700
                              }}>
                                  {avg}
                              </div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg</span>
                      </div>
                  </div>
                  
                  <div style={{ marginTop: '1.5rem', background: 'var(--color-bg-secondary)', padding: '0.8rem', borderRadius: '8px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                           <span style={{ color: failing > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                               At Risk (Avg &lt; 3.0)
                           </span>
                           <span style={{ fontWeight: 700, color: failing > 0 ? 'var(--color-danger)' : 'inherit' }}>
                               {failing} Student{failing !== 1 ? 's' : ''}
                           </span>
                       </div>
                  </div>
                  
                  <div style={{ 
                    marginTop: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: 'var(--color-accent)',
                    fontWeight: 500,
                    fontSize: '0.95rem'
                  }}>
                    View Gradebook <ChevronRight size={18} />
                  </div>
                </div>
              </Link>
            )
        })}
        
        {courses.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No courses found. Add a student to create a course.</p>
            <Link to="/register" className="btn" style={{ marginTop: '1rem' }}>
              Add First Student
            </Link>
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '400px', padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Create New Course</h3>
                <form onSubmit={handleCreateCourse}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Grade / Curso</label>
                            <input 
                                className="input-field"
                                placeholder="e.g. 901"
                                value={newCourseGrade}
                                onChange={(e) => setNewCourseGrade(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Jornada</label>
                            <select 
                                className="input-field"
                                value={newCourseJornada}
                                onChange={(e) => setNewCourseJornada(e.target.value)}
                            >
                                <option value="JM">JM (Mañana)</option>
                                <option value="JT">JT (Tarde)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Course Director</label>
                         <input 
                             className="input-field"
                             placeholder="e.g. Maria Gonzalez"
                             value={newCourseDirector}
                             onChange={(e) => setNewCourseDirector(e.target.value)}
                         />
                    </div>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                         <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Schedule / Horario</label>
                         <input 
                             className="input-field"
                             placeholder="e.g. Lunes 2da y 3ra hora"
                             value={newCourseSchedule}
                             onChange={(e) => setNewCourseSchedule(e.target.value)}
                         />
                    </div>
                    
                    <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', background: '#f5f5f7', padding: '0.5rem', borderRadius: '4px' }}>
                        Creating: {newCourseGrade ? `${newCourseGrade}-${newCourseJornada}` : '...'}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={() => setShowCreateCourseModal(false)}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn">
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
