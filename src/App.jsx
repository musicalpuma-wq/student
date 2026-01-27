import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { StudentRegistration } from './pages/StudentRegistration';
import { CourseGradebook } from './pages/CourseGradebook';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="register" element={<StudentRegistration />} />
          <Route path="course/:courseId" element={<CourseGradebook />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
