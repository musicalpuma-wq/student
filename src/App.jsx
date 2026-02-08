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

  /* 
   * Authentication is now session-only (in-memory). 
   * Reloading the page will require logging in again.
   */

  const handleLogin = () => {
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
