import { useState, useEffect } from 'react';
import { DataStore } from '../services/DataStore';
import { Link } from 'react-router-dom';
import { Users, ChevronRight, GraduationCap } from 'lucide-react';

export function Dashboard() {
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

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
          Welcome back. Here is an overview of your classes.
        </p>
      </header>
      
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {courses.map(course => {
            const studentCount = DataStore.getStudentsByCourse(course).length;
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
                  transition: 'all 0.2s ease'
                }}>
                  <div>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '0.4rem 0.8rem', 
                      background: '#f5f5f7', 
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      marginBottom: '1rem'
                    }}>
                      Course
                    </div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{course}</h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{studentCount} Students</p>
                  </div>
                  
                  <div style={{ 
                    marginTop: '2rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: 'var(--color-accent)',
                    fontWeight: 500
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
