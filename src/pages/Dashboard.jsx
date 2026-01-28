import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { Link, useNavigate } from 'react-router-dom';
import { Users, ChevronRight, GraduationCap } from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalCourses: 0 });

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
      if (students.length === 0) return { avg: 0, failing: 0 };

      const studentAverages = students.map(s => {
          const grades = Object.values(s.grades).map(v => parseFloat(v)).filter(v => !isNaN(v));
          if (grades.length === 0) return null;
          return grades.reduce((a, b) => a + b, 0) / grades.length;
      }).filter(a => a !== null);

      if (studentAverages.length === 0) return { avg: 0, failing: 0 };

      const courseAvg = studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length;
      const failingCount = studentAverages.filter(a => a < 3.0).length;

      return { avg: courseAvg.toFixed(1), failing: failingCount };
  };

  return (
    <div>
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
            <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>Dashboard</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
            Welcome back. Here is an overview of your classes.
            </p>
        </div>
        <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Quick Access
            </label>
            <select 
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                onChange={(e) => {
                    if (e.target.value) {
                        navigate(`/course/${e.target.value}`);
                    }
                }}
            >
                <option value="">Jump to Course...</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Note: In a real app I would use useNavigate() hook at top level. 
               Let's Fix this: I'll use a small inline navigation helper or just assume the user updates the URL manually? 
               Wait, I can just use a proper select with onChange executing a navigation.
            */}
        </div>
      </header>
      
      {/* Quick Access Logic Hook - I'll actually add useNavigate above */}
      
      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(52, 199, 89, 0.1)', color: 'var(--color-success)', borderRadius: '50%' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Total Students</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.totalStudents}</p>
          </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(0, 113, 227, 0.1)', color: 'var(--color-accent)', borderRadius: '50%' }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Active Courses</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.totalCourses}</p>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Your Courses</h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {courses.map(course => {
            const studentCount = DataStore.getStudentsByCourse(course).length;
            const { avg, failing } = calculateCourseStats(course);
            const numAvg = parseFloat(avg);
            
            // Simple Pie Chart as Conic Gradient
            // 5.0 is max. Let's say the green part is the average percentage. (Avg/5 * 100)
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
                          marginBottom: '0.5rem'
                        }}>
                          Course
                        </div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.2rem' }}>{course}</h2>
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
                                  background: 'white',
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
                  
                  <div style={{ marginTop: '1.5rem', background: '#f9f9f9', padding: '0.8rem', borderRadius: '8px' }}>
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
    </div>
  );
}
