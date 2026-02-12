import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { StudentRegistration } from './pages/StudentRegistration';
import { CourseGradebook } from './pages/CourseGradebook';
import { Downloads } from './pages/Downloads';
import { Login } from './pages/Login';
import { SettingsProvider } from './context/SettingsContext';
import { GlobalModalProvider } from './context/GlobalModalContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /* 
   * Authentication is now session-only (in-memory). 
   * Reloading the page will require logging in again.
   */

  return (
    <SettingsProvider>
      <GlobalModalProvider>
        <BrowserRouter>
          {!isAuthenticated ? (
             <Login onLogin={() => setIsAuthenticated(true)} />
          ) : (
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="register" element={<StudentRegistration />} />
                <Route path="course/:courseId" element={<CourseGradebook />} />
                <Route path="downloads" element={<Downloads />} />
              </Route>
            </Routes>
          )}
        </BrowserRouter>
      </GlobalModalProvider>
    </SettingsProvider>
  );
}

export default App
