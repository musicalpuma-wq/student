const STORAGE_KEY = 'sms_data_v1';

const initialData = {
  students: [],
  activities: {}, // { courseId: [ { id, name, maxGrade } ] }
  materials: {}, // { courseId: [ { id, name } ] }
};

export const DataStore = {
  // Load full state
  load: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : initialData;
    // Migration for existing data without materials
    if (!parsed.materials) parsed.materials = {};
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
      if (!s.age) s.age = 1;
      if (!s.parentName) s.parentName = "Pending";
      if (!s.parentPhone) s.parentPhone = "Pending";
      if (!s.parentPhone2) s.parentPhone2 = "Pending";
      if (!s.parentEmail) s.parentEmail = "pending@pending.co";
      if (!s.vpsCode) s.vpsCode = "Pending"; // Optional but asked to fill text
      // genericObs? "Pending" might be annoying if truly optional, but user said "if a student lacks data".
      // I'll stick to the "Profile" fields.
      if (!s.grades) s.grades = {};
      if (!s.attendance) s.attendance = {};
      if (!s.materials) s.materials = {};
      if (!s.observations) s.observations = [];
      return s;
  },

  addStudent: (student) => {
    const data = DataStore.load();
    const sanitized = DataStore.sanitizeStudent(student);
    const newStudent = { ...sanitized, id: crypto.randomUUID(), grades: {}, attendance: {} };
    data.students.push(newStudent);
    DataStore.save(data);
    return newStudent;
  },

  updateStudent: (updatedStudent) => {
    const data = DataStore.load();
    const index = data.students.findIndex(s => s.id === updatedStudent.id);
    if (index !== -1) {
      data.students[index] = DataStore.sanitizeStudent(updatedStudent);
      DataStore.save(data);
    }
  },

  // Courses (derived from students)
  getCourses: () => {
    const students = DataStore.getStudents();
    const courses = [...new Set(students.map(s => s.course))].sort();
    return courses;
  },

  getStudentsByCourse: (course) => {
    return DataStore.getStudents().filter(s => s && s.course === course).map(s => DataStore.sanitizeStudent(s));
  },

  updateCourseName: (oldName, newName) => {
    if (oldName === newName) return;
    const data = DataStore.load();
    
    // 1. Update students
    let changed = false;
    data.students.forEach(s => {
      if (s.course === oldName) {
        s.course = newName;
        changed = true;
      }
    });

    // 2. Update activities key
    if (data.activities[oldName]) {
      data.activities[newName] = data.activities[oldName];
      delete data.activities[oldName];
      changed = true;
    }

    // 3. Update materials key
    if (data.materials && data.materials[oldName]) {
      data.materials[newName] = data.materials[oldName];
      delete data.materials[oldName];
      changed = true;
    }

    if (changed) DataStore.save(data);
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
