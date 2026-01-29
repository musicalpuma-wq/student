import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { StudentRegistration } from './pages/StudentRegistration';
import { CourseGradebook } from './pages/CourseGradebook';
import { Downloads } from './pages/Downloads';
import { Login } from './pages/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('isAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    localStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="register" element={<StudentRegistration />} />
          <Route path="course/:courseId" element={<CourseGradebook />} />
          <Route path="downloads" element={<Downloads />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
