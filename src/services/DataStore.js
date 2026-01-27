const STORAGE_KEY = 'sms_data_v1';

const initialData = {
  students: [],
  activities: {}, // { courseId: [ { id, name, maxGrade } ] }
};

export const DataStore = {
  // Load full state
  load: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialData;
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

  addStudent: (student) => {
    const data = DataStore.load();
    const newStudent = { ...student, id: crypto.randomUUID(), grades: {}, attendance: {} };
    data.students.push(newStudent);
    DataStore.save(data);
    return newStudent;
  },

  updateStudent: (updatedStudent) => {
    const data = DataStore.load();
    const index = data.students.findIndex(s => s.id === updatedStudent.id);
    if (index !== -1) {
      data.students[index] = updatedStudent;
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
    return DataStore.getStudents().filter(s => s.course === course);
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

  // Seed Data
  seedMockData: () => {
    const mockStudents = Array.from({ length: 50 }).map((_, i) => ({
      id: crypto.randomUUID(),
      name: `Student ${i + 1}`,
      course: i % 2 === 0 ? '6-A' : '6-B',
      age: 12 + (i % 3),
      parentName: `Parent ${i + 1}`,
      parentPhone: `555-00${i}`,
      vpsCode: `VPS${1000 + i}`,
      grades: {},
      attendance: {},
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
