const STORAGE_KEY = 'sms_data_v1';

const initialData = {
  students: [],
  courses: [], // Explicit list of course names
  activities: {}, // { courseId: [ { id, name, maxGrade } ] }
  materials: {}, // { courseId: [ { id, name } ] }
};

export const DataStore = {
  // Load full state
  load: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    let parsed = data ? JSON.parse(data) : initialData;
    
    // Migration for existing data without materials
    if (!parsed.materials) parsed.materials = {};
    
    // Migration for explicit courses
    if (!parsed.courses) {
        // Derive from students if missing
        const derived = [...new Set(parsed.students.map(s => s.course))].sort();
        parsed.courses = derived;
    }
    
    return parsed;
  },

  // Save full state
  save: (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  // Students
  getStudents: () => {
    const data = DataStore.load();
    return data.students;
  },

  // Helper to apply defaults
  sanitizeStudent: (student) => {
      const s = { ...student };
      if (!s.name) s.name = "Pending";
      if (!s.course) s.course = "Pending";
      if (!s.name) s.name = "Pending";
      if (!s.course) s.course = "Pending";
      
      // Age / DOB Logic & Migration
      if (!s.birthDate) {
          if (s.age) {
              // Migration: Set to Jan 1st of the birth year
              const currentYear = new Date().getFullYear();
              const birthYear = currentYear - parseInt(s.age);
              s.birthDate = `${birthYear}-01-01`;
          } else {
              // Default if neither exists (e.g. new empty)
              s.birthDate = `${new Date().getFullYear() - 10}-01-01`; // Default ~10yo
          }
      }
      // Recalculate age from birthDate to ensure consistency
      const dob = new Date(s.birthDate);
      const diffMs = Date.now() - dob.getTime();
      const ageDate = new Date(diffMs); 
      s.age = Math.abs(ageDate.getUTCFullYear() - 1970);

      if (!s.parentName) s.parentName = "Pending";
      if (!s.parentPhone) s.parentPhone = "Pending";
      if (!s.parentPhone2) s.parentPhone2 = "Pending";
      if (!s.parentEmail) s.parentEmail = "pending@pending.co";
      if (!s.vpsCode) s.vpsCode = "Pending"; 
      if (!s.grades) s.grades = {};
      if (!s.attendance) s.attendance = {};
      if (!s.materials) s.materials = {};
      if (!s.observations) s.observations = []; 
      if (!s.annotations) s.annotations = []; 
      return s;
  },

  addStudent: (student) => {
    const data = DataStore.load();
    const sanitized = DataStore.sanitizeStudent(student);
    const newStudent = { ...sanitized, id: crypto.randomUUID(), grades: {}, attendance: {} };
    data.students.push(newStudent);
    
    // Ensure course exists in list
    if (newStudent.course && !data.courses.includes(newStudent.course)) {
        data.courses.push(newStudent.course);
        data.courses.sort();
    }
    
    DataStore.save(data);
    return newStudent;
  },

  updateStudent: (updatedStudent) => {
    const data = DataStore.load();
    const index = data.students.findIndex(s => s.id === updatedStudent.id);
    if (index !== -1) {
      data.students[index] = DataStore.sanitizeStudent(updatedStudent);
      
      // Ensure course exists (in case of move)
      if (updatedStudent.course && !data.courses.includes(updatedStudent.course)) {
          data.courses.push(updatedStudent.course);
          data.courses.sort();
      }
      
      DataStore.save(data);
    }
  },

  deleteStudent: (studentId) => {
    const data = DataStore.load();
    const initialLength = data.students.length;
    data.students = data.students.filter(s => s.id !== studentId);
    
    // We do NOT remove the course automatically if it becomes empty, 
    // to allow empty courses to exist as per user request.
    
    if (data.students.length !== initialLength) {
        DataStore.save(data);
        return true;
    }
    return false;
  },

  // Courses
  getCourses: () => {
    const data = DataStore.load();
    return data.courses || [];
  },

  addCourse: (courseName) => {
      const data = DataStore.load();
      if (!data.courses.includes(courseName)) {
          data.courses.push(courseName);
          data.courses.sort();
          DataStore.save(data);
          return true;
      }
      return false;
  },

  getStudentsByCourse: (course) => {
    return DataStore.getStudents().filter(s => s && s.course === course).map(s => DataStore.sanitizeStudent(s));
  },

  updateCourseName: (oldName, newName) => {
    if (oldName === newName) return;
    const data = DataStore.load();
    
    // 1. Update course list
    const courseIndex = data.courses.indexOf(oldName);
    if (courseIndex !== -1) {
        data.courses[courseIndex] = newName;
        data.courses.sort();
    } else {
        // Should catch this, but just add if missing
        data.courses.push(newName);
        data.courses.sort();
    }
    
    // 2. Update students
    let changed = true; // Course list changed at least
    data.students.forEach(s => {
      if (s.course === oldName) {
        s.course = newName;
      }
    });

    // 3. Update activities key
    if (data.activities[oldName]) {
      data.activities[newName] = data.activities[oldName];
      delete data.activities[oldName];
    }

    // 4. Update materials key
    if (data.materials && data.materials[oldName]) {
      data.materials[newName] = data.materials[oldName];
      delete data.materials[oldName];
    }

    DataStore.save(data);
  },

  // Delete Course
  deleteCourse: (courseName) => {
    const data = DataStore.load();
    
    // 1. Remove from list
    data.courses = data.courses.filter(c => c !== courseName);

    // 2. Remove students
    data.students = data.students.filter(s => s.course !== courseName);

    // 3. Remove activities
    if (data.activities[courseName]) {
      delete data.activities[courseName];
    }

    // 4. Remove materials
    if (data.materials && data.materials[courseName]) {
      delete data.materials[courseName];
    }

    DataStore.save(data);
  },

  // Activities
  getActivities: (course) => {
    const data = DataStore.load();
    return data.activities[course] || [];
  },

  addActivity: (course, activityName) => {
    const data = DataStore.load();
    if (!data.activities[course]) {
      data.activities[course] = [];
    }
    const newActivity = { id: crypto.randomUUID(), name: activityName };
    data.activities[course].push(newActivity);
    DataStore.save(data);
    return newActivity;
  },
  
  updateActivity: (course, activity) => {
       const data = DataStore.load();
       if (data.activities[course]) {
           const idx = data.activities[course].findIndex(a => a.id === activity.id);
           if (idx !== -1) {
               data.activities[course][idx] = activity;
               DataStore.save(data);
           }
       }
  },

  // Materials
  getMaterials: (course) => {
    const data = DataStore.load();
    return data.materials?.[course] || [];
  },

  addMaterialColumn: (course, materialName) => {
    const data = DataStore.load();
    if (!data.materials) data.materials = {};
    if (!data.materials[course]) {
      data.materials[course] = [];
    }
    const newMaterial = { id: crypto.randomUUID(), name: materialName };
    data.materials[course].push(newMaterial);
    DataStore.save(data);
    return newMaterial;
  },

  // Seed Data
  seedMockData: () => {
    const mockStudents = Array.from({ length: 50 }).map((_, i) => ({
      id: crypto.randomUUID(),
      name: `Student ${i + 1}`,
      course: i % 2 === 0 ? '6-A' : '6-B',
      age: 12 + (i % 3),
      parentName: `Parent ${i + 1}`,
      parentPhone: `555-00${i}`,
      parentPhone2: `555-01${i}`,
      parentEmail: `parent${i+1}@example.com`,
      vpsCode: `VPS${1000 + i}`,
      grades: {},
      attendance: {},
      materials: {}, // { materialId: value }
      annotations: []
    }));
    
    DataStore.save({
        students: mockStudents,
        activities: {
            '6-A': [{ id: 'act1', name: 'Math Exam' }, { id: 'act2', name: 'History Essay' }],
            '6-B': [{ id: 'act3', name: 'Science Lab' }]
        }
    });
  }
};
