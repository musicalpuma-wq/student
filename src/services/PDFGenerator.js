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
      
      if (selectedFields.studentCount) headers.push('#');
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
      const tableBody = students.map((s, i) => {
          const row = [];
          if (selectedFields.studentCount) row.push(i + 1);
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
  },

  // Generate Observer Annotations Report (Optimized for space)
  generateObserverReport: (scope, studentScope, includeVPS = true) => {
    const doc = new jsPDF();
    const courses = scope === 'all' 
        ? DataStore.getCourses()
        : [scope];

    let firstPage = true;

    courses.forEach((courseId) => {
        let students = DataStore.getStudentsByCourse(courseId)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (studentScope && studentScope !== 'all') {
            students = students.filter(s => s.id === studentScope);
        }
        
        // Filter to only students with annotations
        students = students.filter(s => s.annotations && s.annotations.length > 0);

        if (students.length === 0) return; // Skip if no annotations

        if (!firstPage) doc.addPage();
        firstPage = false;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`Observer Annotations - ${courseId}`, 14, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
        doc.setLineWidth(0.5);
        doc.line(14, 28, 196, 28); // Horizontal divider

        let y = 36;
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();

        students.forEach(student => {
            // Check if we need a new page for the student name header
            if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
            }

            // Student Name Header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const vpsText = includeVPS ? ` (VPS: ${student.vpsCode || '-'})` : '';
            doc.text(`${student.name}${vpsText}`, 14, y);
            y += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);

            student.annotations.forEach(note => {
                // Split text to fit width (196 - 20 margin = 176 max width)
                const lines = doc.splitTextToSize(note, 170);
                
                // If this note block doesn't fit, add a new page
                if (y + (lines.length * 5) > pageHeight - 15) {
                    doc.addPage();
                    y = 20;
                }

                doc.text('•', 14, y);
                doc.text(lines, 20, y);
                y += (lines.length * 5) + 2; // Move down dynamically based on lines
            });
            
            y += 4; // Space after a student's block
            
            // Draw subtle line between students for clarity if not at end of page
            if (y < pageHeight - 20) {
                 doc.setDrawColor(200, 200, 200);
                 doc.setLineWidth(0.2);
                 doc.line(14, y - 2, 196, y - 2);
                 doc.setDrawColor(0, 0, 0); // reset
                 y += 4;
            }
        });
    });

    if (firstPage) {
        // No annotations found for any course in scope
        doc.setFontSize(12);
        doc.text("No observer annotations found for the selected criteria.", 14, 20);
    }

    doc.save(`observer_report_${scope === 'all' ? 'all_courses' : scope}.pdf`);
  }
};
