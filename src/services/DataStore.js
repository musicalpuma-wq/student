const STORAGE_KEY = 'sms_data_v1';

const initialData = {
  students: [],
  courses: [], // Explicit list of course names
  courseDetails: {}, // { courseName: { director, schedule } }
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
    if (!parsed.courseDetails) parsed.courseDetails = {};
    
    // Migration for explicit courses
    if (!parsed.courses) {
        // Derive from students if missing
        const derived = [...new Set(parsed.students.map(s => s.course))].sort();
        parsed.courses = derived;
    }
    
    // v2 Migration for Academic Periods
    if (parsed.version !== 'v2') {
        const newActivities = {};
        for (const c in parsed.activities) {
            newActivities[`1_${c}`] = parsed.activities[c];
        }
        parsed.activities = newActivities;

        const newMaterials = {};
        for (const c in parsed.materials) {
            newMaterials[`1_${c}`] = parsed.materials[c];
        }
        parsed.materials = newMaterials;

        parsed.students.forEach(s => {
            if (!s.grades || !s.grades['1'] && typeof s.grades === 'object') {
                if (Object.keys(s.grades || {}).some(k => ['1','2','3','4'].includes(k))) {
                     // already nested somehow
                } else {
                    s.grades = { '1': s.grades || {} };
                }
            }
            if (!s.attendance || !s.attendance['1'] && typeof s.attendance === 'object') {
                if (Object.keys(s.attendance || {}).some(k => ['1','2','3','4'].includes(k))) {
                     // already nested
                } else {
                    s.attendance = { '1': s.attendance || {} };
                }
            }
            if (!s.materials || !s.materials['1'] && typeof s.materials === 'object') {
                 if (Object.keys(s.materials || {}).some(k => ['1','2','3','4'].includes(k))) {
                     // already nested
                 } else {
                     s.materials = { '1': s.materials || {} };
                 }
            }
            
            // Annotations had the array type
            const oldAnnotations = s.annotations || [];
            if (s.annotations_data && s.annotations_data['1']) {
                // Keep if already migrated somewhat
                s.annotations = s.annotations_data;
                delete s.annotations_data;
            } else if (Array.isArray(oldAnnotations)) {
                s.annotations = { '1': oldAnnotations };
            }
        });
        
        parsed.version = 'v2';
        // Auto-save the migration
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
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
      // For version v2, annotations is a dict of lists
      if (!s.annotations) s.annotations = {}; 
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
  
  getCourseDetails: (courseName) => {
      const data = DataStore.load();
      return data.courseDetails?.[courseName] || { director: '', schedule: '' };
  },

  addCourse: (courseName, details = {}) => {
      const data = DataStore.load();
      // Ensure courseDetails exists
      if (!data.courseDetails) data.courseDetails = {};
      
      let saved = false;
      if (!data.courses.includes(courseName)) {
          data.courses.push(courseName);
          data.courses.sort();
          saved = true;
      }
      
      // Always update details if provided or new
      if (details.director !== undefined || details.schedule !== undefined) {
         data.courseDetails[courseName] = {
             director: details.director || '',
             schedule: details.schedule || ''
         };
         saved = true;
      }

      if (saved) {
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
    ['1', '2', '3', '4'].forEach(p => {
        const oldKey = `${p}_${oldName}`;
        const newKey = `${p}_${newName}`;
        if (data.activities[oldKey]) {
          data.activities[newKey] = data.activities[oldKey];
          delete data.activities[oldKey];
        }
        // 4. Update materials key
        if (data.materials && data.materials[oldKey]) {
          data.materials[newKey] = data.materials[oldKey];
          delete data.materials[oldKey];
        }
    });
    
    // 5. Update Details
    if (data.courseDetails && data.courseDetails[oldName]) {
        data.courseDetails[newName] = data.courseDetails[oldName];
        delete data.courseDetails[oldName];
    }

    DataStore.save(data);
  },
  
  updateCourseDetails: (courseName, details) => {
      const data = DataStore.load();
      if (!data.courseDetails) data.courseDetails = {};
      data.courseDetails[courseName] = {
          ...data.courseDetails[courseName],
          ...details
      };
      DataStore.save(data);
  },

  // Delete Course
  deleteCourse: (courseName) => {
    const data = DataStore.load();
    
    // 1. Remove from list
    data.courses = data.courses.filter(c => c !== courseName);

    // 2. Remove students
    data.students = data.students.filter(s => s.course !== courseName);

    // 3. & 4. Remove activities and materials for all periods
    ['1', '2', '3', '4'].forEach(p => {
        const key = `${p}_${courseName}`;
        if (data.activities[key]) delete data.activities[key];
        if (data.materials && data.materials[key]) delete data.materials[key];
    });
    
    // 5. Remove details
    if (data.courseDetails && data.courseDetails[courseName]) {
        delete data.courseDetails[courseName];
    }

    DataStore.save(data);
  },

  // Activities
  getActivities: (course, period) => {
    const data = DataStore.load();
    const key = `${period}_${course}`;
    return data.activities[key] || [];
  },

  addActivity: (course, period, activityName) => {
    const data = DataStore.load();
    const key = `${period}_${course}`;
    if (!data.activities[key]) {
      data.activities[key] = [];
    }
    const today = new Date().toISOString().split('T')[0];
    const newActivity = { id: crypto.randomUUID(), name: activityName, date: today, locked: false };
    data.activities[key].push(newActivity);
    DataStore.save(data);
    return newActivity;
  },
  
  updateActivity: (course, period, activity) => {
       const data = DataStore.load();
       const key = `${period}_${course}`;
       if (data.activities[key]) {
           const idx = data.activities[key].findIndex(a => a.id === activity.id);
           if (idx !== -1) {
               data.activities[key][idx] = activity;
               DataStore.save(data);
           }
       }
  },

  deleteActivity: (course, period, activityId) => {
      const data = DataStore.load();
      const key = `${period}_${course}`;
      if (data.activities && data.activities[key]) {
          // Remove activity definition
          data.activities[key] = data.activities[key].filter(a => a.id !== activityId);
          
          // Remove grades for this activity
          data.students.forEach(s => {
              if (s.course === course && s.grades && s.grades[period]) {
                  delete s.grades[period][activityId];
              }
          });
          
          DataStore.save(data);
      }
  },

  deleteAttendanceColumn: (course, period, date) => {
      const data = DataStore.load();
      let changed = false;
      data.students.forEach(s => {
          if (s.course === course && s.attendance && s.attendance[period]) {
              // We just check if the key exists to mark changed, ensuring save is called if needed
              if (Object.prototype.hasOwnProperty.call(s.attendance[period], date)) {
                  delete s.attendance[period][date];
                  changed = true;
              }
          }
      });
      if (changed) {
          DataStore.save(data);
      }
  },

  // Materials
  getMaterials: (course, period) => {
    const data = DataStore.load();
    const key = `${period}_${course}`;
    return data.materials?.[key] || [];
  },

  addMaterialColumn: (course, period, materialName) => {
    const data = DataStore.load();
    if (!data.materials) data.materials = {};
    const key = `${period}_${course}`;
    if (!data.materials[key]) {
      data.materials[key] = [];
    }
    const newMaterial = { id: crypto.randomUUID(), name: materialName };
    data.materials[key].push(newMaterial);
    DataStore.save(data);
    return newMaterial;
  },

  updateMaterial: (course, period, material) => {
      const data = DataStore.load();
      const key = `${period}_${course}`;
      if (data.materials && data.materials[key]) {
          const idx = data.materials[key].findIndex(m => m.id === material.id);
          if (idx !== -1) {
              data.materials[key][idx] = { ...data.materials[key][idx], ...material };
              DataStore.save(data);
          }
      }
  },

  deleteMaterial: (course, period, materialId) => {
      const data = DataStore.load();
      const key = `${period}_${course}`;
      if (data.materials && data.materials[key]) {
          // Remove material definition
          data.materials[key] = data.materials[key].filter(m => m.id !== materialId);
          
          // Remove values for this material
          data.students.forEach(s => {
              if (s.course === course && s.materials && s.materials[period]) {
                  delete s.materials[period][materialId];
              }
          });
          
          DataStore.save(data);
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
        courses: ['6-A', '6-B'],
        courseDetails: {
            '6-A': { director: 'Mr. Smith', schedule: 'Mon 8-10am' },
            '6-B': { director: 'Mrs. Johnson', schedule: 'Tue 10-12pm' }
        },
        activities: {
            '6-A': [{ id: 'act1', name: 'Math Exam' }, { id: 'act2', name: 'History Essay' }],
            '6-B': [{ id: 'act3', name: 'Science Lab' }]
        },
        materials: {}
    });
  }
};
