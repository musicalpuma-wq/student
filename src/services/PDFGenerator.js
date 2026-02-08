import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataStore } from './DataStore';

export const PDFGenerator = {
  // Generate Student List (Registration Data)
  generateStudentDataReport: (scope, selectedFields) => {
    // scope: 'all' or specific courseId
    // selectedFields: { name: true, age: true, ... }

    const doc = new jsPDF();
    const courses = scope === 'all' 
        ? DataStore.getCourses()
        : [scope];

    courses.forEach((courseId, index) => {
      if (index > 0) doc.addPage();

      doc.setFontSize(18);
      doc.text(`Student List - ${courseId}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

      const students = DataStore.getStudentsByCourse(courseId)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Define Columns
      const tableHead = [];
      const headers = [];
      
      if (selectedFields.vpsCode) headers.push('VPS');
      if (selectedFields.name) headers.push('Name');
      if (selectedFields.age) headers.push('Age');
      if (selectedFields.jornada) headers.push('Jornada');
      if (selectedFields.parentName) headers.push('Parent Name');
      if (selectedFields.parentPhone) headers.push('Phone');
      if (selectedFields.parentEmail) headers.push('Email');
      if (selectedFields.generalObservations) headers.push('General Observations');
      
      tableHead.push(headers);

      // Define Rows
      const tableBody = students.map(s => {
          const row = [];
          if (selectedFields.vpsCode) row.push(s.vpsCode || '-');
          if (selectedFields.name) row.push(s.name);
          if (selectedFields.age) row.push(s.age);
          if (selectedFields.jornada) row.push(s.jornada || '');
          if (selectedFields.parentName) row.push(s.parentName);
          if (selectedFields.parentPhone) row.push(s.parentPhone);
          if (selectedFields.parentEmail) row.push(s.parentEmail);
          if (selectedFields.generalObservations) {
              // Join all annotations into a single string
              const obs = (s.annotations || []).join('\n');
              row.push(obs);
          }
          return row;
      });

      autoTable(doc, {
        startY: 35,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
      });
    });

    doc.save(`student_report_${scope === 'all' ? 'all_courses' : scope}.pdf`);
  },

  // Generate Gradebook
  generateGradesReport: (scope) => {
    const doc = new jsPDF('l'); // Landscape for grades
    const courses = scope === 'all' 
        ? DataStore.getCourses()
        : [scope];

    courses.forEach((courseId, index) => {
      if (index > 0) doc.addPage();

      // Header
      doc.setFontSize(18);
      doc.text(`Gradebook - ${courseId}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

      const students = DataStore.getStudentsByCourse(courseId)
        .sort((a, b) => a.name.localeCompare(b.name));
      const activities = DataStore.getActivities(courseId);

      // Columns
      // VPS, Name, [Activities...], Average
      const headers = ['VPS', 'Name', ...activities.map(a => a.name), 'Avg.'];
      
      const body = students.map(s => {
          const row = [
              s.vpsCode || '-',
              s.name
          ];
          
          let sum = 0;
          let count = 0;

          activities.forEach(a => {
              const g = (s.grades || {})[a.id];
              const val = parseFloat(g);
              if (!isNaN(val)) {
                  row.push(val.toFixed(1));
                  sum += val;
                  count++;
              } else {
                  row.push('-');
                  // Empty treated as 1.0 for avg? user said "empty cells count as 1.0"
                  sum += 1.0;
                  count++;
              }
          });

          // Calc avg
          // Wait, user logic: "las casillas vacías tómalas como un '1,0'".
          // My previous logic in Header was correct. Here too.
          // Note: If no activities exist, avg is '-'.
          const avg = count > 0 ? (sum / count).toFixed(1) : '-';
          row.push(avg);
          
          return row;
      });

      autoTable(doc, {
        startY: 35,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [0, 113, 227] }, // Blue accent
        styles: { fontSize: 8 }
      });
    });

    doc.save(`gradebook_${scope === 'all' ? 'all_courses' : scope}.pdf`);
  }
};
