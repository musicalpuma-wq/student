import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataStore } from './DataStore';
import { formatBogotaDate } from '../utils/dateUtils';

export const PDFGenerator = {
  // Generate Student List (Registration Data)
  generateStudentDataReport: (scope, selectedFields) => {
    const doc = new jsPDF();
    const courses = scope === 'all'
        ? DataStore.getCourses()
        : [scope];

    courses.forEach((courseId, index) => {
      if (index > 0) doc.addPage();

      doc.setFontSize(18);
      doc.text(`Student List - ${courseId}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${formatBogotaDate()}`, 14, 28);

      const students = DataStore.getStudentsByCourse(courseId)
        .sort((a, b) => a.name.localeCompare(b.name));

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
              // Join all annotations across all periods
              const allAnnotations = [];
              if (s.annotations && typeof s.annotations === 'object' && !Array.isArray(s.annotations)) {
                  for (const p of ['1','2','3','4']) {
                      if (s.annotations[p]) allAnnotations.push(...s.annotations[p]);
                  }
              } else if (Array.isArray(s.annotations)) {
                  allAnnotations.push(...s.annotations);
              }
              row.push(allAnnotations.join('\n'));
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
  generateGradesReport: (scope, periodScope) => {
    // periodScope: 'all' or '1','2','3','4'
    const doc = new jsPDF('l'); // Landscape for grades
    const courses = scope === 'all'
        ? DataStore.getCourses()
        : [scope];
    const periods = periodScope === 'all' ? ['1','2','3','4'] : [periodScope];

    let firstPage = true;

    courses.forEach((courseId) => {
      periods.forEach((period) => {
        const activities = DataStore.getActivities(courseId, period);
        if (activities.length === 0) return; // Skip empty periods

        if (!firstPage) doc.addPage('l');
        firstPage = false;

        doc.setFontSize(18);
        doc.text(`Gradebook - ${courseId}`, 14, 20);
        doc.setFontSize(11);
        doc.text(`Period ${period}`, 14, 27);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatBogotaDate()}`, 14, 33);

        const students = DataStore.getStudentsByCourse(courseId)
          .sort((a, b) => a.name.localeCompare(b.name));

        const headers = ['VPS', 'Name', ...activities.map(a => a.name), 'Heteroevaluación', 'Co-evaluación', 'Auto-evaluación'];

        const body = students.map(s => {
            const row = [
                s.vpsCode || '-',
                s.name
            ];

            let sum = 0;
            let count = 0;
            const periodGrades = (s.grades && s.grades[period]) || {};

            activities.forEach(a => {
                const g = periodGrades[a.id];
                const val = parseFloat(g);
                if (!isNaN(val)) {
                    row.push(val.toFixed(1));
                    sum += val;
                    count++;
                } else {
                    row.push('-');
                    sum += 1.0;
                    count++;
                }
            });

            const avg = count > 0 ? (sum / count).toFixed(1) : '-';
            row.push(avg);
            row.push(s.coevaluation?.[period] || '-');
            row.push(s.autoevaluation?.[period] || '-');

            return row;
        });

        autoTable(doc, {
          startY: 38,
          head: [headers],
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [0, 113, 227] },
          styles: { fontSize: 8 }
        });
      });
    });

    if (firstPage) {
      doc.setFontSize(12);
      doc.text("No grade data found for the selected criteria.", 14, 20);
    }

    const periodLabel = periodScope === 'all' ? 'all_periods' : `period_${periodScope}`;
    doc.save(`gradebook_${scope === 'all' ? 'all_courses' : scope}_${periodLabel}.pdf`);
  },

  // Generate Attendance Report
  generateAttendanceReport: (scope, periodScope) => {
    const doc = new jsPDF('l'); // Landscape for dates
    const courses = scope === 'all'
        ? DataStore.getCourses()
        : [scope];
    const periods = periodScope === 'all' ? ['1','2','3','4'] : [periodScope];

    let firstPage = true;

    courses.forEach((courseId) => {
      periods.forEach((period) => {
        const students = DataStore.getStudentsByCourse(courseId)
          .sort((a, b) => a.name.localeCompare(b.name));

        // Collect all unique dates for this course+period
        const dateSet = new Set();
        students.forEach(s => {
          const periodAttendance = (s.attendance && s.attendance[period]) || {};
          Object.keys(periodAttendance).forEach(d => dateSet.add(d));
        });
        const dates = [...dateSet].sort();

        if (dates.length === 0) return; // Skip empty periods

        if (!firstPage) doc.addPage('l');
        firstPage = false;

        doc.setFontSize(18);
        doc.text(`Attendance - ${courseId}`, 14, 20);
        doc.setFontSize(11);
        doc.text(`Period ${period}`, 14, 27);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatBogotaDate()}`, 14, 33);

        // Format date headers (MM/DD)
        const shortDates = dates.map(d => {
          const parts = d.split('-');
          return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
        });

        const headers = ['VPS', 'Name', ...shortDates, 'Abs.', 'Late'];

        const body = students.map(s => {
          const periodAttendance = (s.attendance && s.attendance[period]) || {};
          const row = [s.vpsCode || '-', s.name];
          let absences = 0;
          let lates = 0;

          dates.forEach(d => {
            const status = periodAttendance[d];
            if (status === 'absent') {
              row.push('F');
              absences++;
            } else if (status === 'late') {
              row.push('R');
              lates++;
            } else if (status === 'present') {
              row.push('✓');
            } else {
              row.push('');
            }
          });

          row.push(absences > 0 ? absences : '-');
          row.push(lates > 0 ? lates : '-');
          return row;
        });

        autoTable(doc, {
          startY: 38,
          head: [headers],
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [52, 199, 89] }, // Green accent
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 35 },
          }
        });
      });
    });

    if (firstPage) {
      doc.setFontSize(12);
      doc.text("No attendance records found for the selected criteria.", 14, 20);
    }

    const periodLabel = periodScope === 'all' ? 'all_periods' : `period_${periodScope}`;
    doc.save(`attendance_${scope === 'all' ? 'all_courses' : scope}_${periodLabel}.pdf`);
  },

  // Generate Observer Annotations Report
  generateObserverReport: (scope, studentScope, includeVPS, periodScope, subjectName, ecoMode = false) => {
    const doc = new jsPDF();
    const courses = scope === 'all'
        ? DataStore.getCourses()
        : [scope];
    const periods = periodScope === 'all' ? ['1','2','3','4'] : [periodScope];

    // Eco mode constants
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const margin = ecoMode ? 10 : 14;
    const colGap = 6;
    const colWidth = ecoMode ? (pageWidth - margin * 2 - colGap) / 2 : (pageWidth - margin * 2);
    const textWidth = ecoMode ? colWidth - 4 : 170;
    const fontSize = ecoMode ? 8 : 10;
    const nameSize = ecoMode ? 9 : 13;
    const lineH = ecoMode ? 3.2 : 5;
    const noteGap = ecoMode ? 0.5 : 2;
    const blockGap = ecoMode ? 4 : 8;
    const periodHeaderH = ecoMode ? 4 : 6;

    // Collect all student blocks across courses
    const allBlocks = [];

    courses.forEach((courseId) => {
        let students = DataStore.getStudentsByCourse(courseId)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (studentScope && studentScope !== 'all') {
            students = students.filter(s => s.id === studentScope);
        }

        students = students.filter(s => {
            if (!s.annotations || typeof s.annotations !== 'object') return false;
            return periods.some(p => s.annotations[p] && s.annotations[p].length > 0);
        });

        students.forEach(student => {
            const annotationsByPeriod = [];
            periods.forEach(p => {
                const notes = (student.annotations && student.annotations[p]) || [];
                if (notes.length > 0) {
                    annotationsByPeriod.push({ period: p, notes });
                }
            });
            if (annotationsByPeriod.length === 0) return;
            allBlocks.push({ student, courseId, annotationsByPeriod });
        });
    });

    if (allBlocks.length === 0) {
        doc.setFontSize(12);
        doc.text("No observer annotations found for the selected criteria.", 14, 20);
        doc.save(`observer_report_${scope === 'all' ? 'all_courses' : scope}.pdf`);
        return;
    }

    // Estimate block height
    const estimateBlock = (block) => {
        let h = 0;
        h += ecoMode ? 3.5 : 5; // name
        if (!ecoMode) h += 3 + 6; // course info + divider
        block.annotationsByPeriod.forEach(({ notes }) => {
            if (periods.length > 1) h += periodHeaderH;
            notes.forEach(note => {
                const lines = doc.splitTextToSize(note, textWidth);
                h += (lines.length * lineH) + noteGap;
            });
            h += ecoMode ? 1 : 2;
        });
        h += blockGap;
        return h;
    };

    // Render a single student block at (x, y), returns new y after block
    const renderBlock = (block, x, startY) => {
        let y = startY;
        const { student, courseId: cId, annotationsByPeriod } = block;

        // Student name header
        doc.setFontSize(nameSize);
        doc.setFont('helvetica', 'bold');
        const vpsText = includeVPS ? ` (${student.vpsCode || '-'})` : '';
        const subjectText = subjectName
            ? (ecoMode ? ` — ${subjectName} ${cId}` : ` — ${subjectName}`)
            : (ecoMode ? ` — ${cId}` : '');
        const nameStr = `${student.name}${vpsText}${subjectText}`;
        const nameLines = doc.splitTextToSize(nameStr, textWidth);
        doc.text(nameLines, x, y);
        y += nameLines.length * (ecoMode ? 3.5 : 5);

        if (!ecoMode) {
            // Course info line
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text(`${cId}  |  Generated: ${formatBogotaDate()}`, x, y);
            doc.setTextColor(0, 0, 0);
            y += 3;
            // Divider
            doc.setLineWidth(0.5);
            doc.line(x, y, x + textWidth, y);
            y += 6;
        }

        annotationsByPeriod.forEach(({ period, notes }) => {
            if (periods.length > 1) {
                doc.setFontSize(ecoMode ? 8 : 11);
                doc.setFont('helvetica', 'bold');
                doc.text(`P${period}`, x, y);
                y += periodHeaderH;
                doc.setFont('helvetica', 'normal');
            }

            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'normal');

            notes.forEach(note => {
                const lines = doc.splitTextToSize(note, textWidth);
                if (ecoMode) {
                    doc.text(lines, x, y);
                } else {
                    doc.text('•', x, y);
                    doc.text(lines, x + 6, y);
                }
                y += (lines.length * lineH) + noteGap;
            });
            y += ecoMode ? 1 : 2;
        });

        if (!ecoMode) {
            // Dashed cut line
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([3, 3], 0);
            doc.line(x - 4, y, x + textWidth + 4, y);
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0, 0, 0);
        }

        y += blockGap;
        return y;
    };

    if (ecoMode) {
        // --- Two-column eco layout ---
        let col = 0; // 0 = left, 1 = right
        let colY = [margin, margin];
        let firstPage = true;

        const colX = (c) => c === 0 ? margin : margin + colWidth + colGap;

        const newPage = () => {
            if (!firstPage) doc.addPage();
            firstPage = false;
            colY = [margin, margin];
            col = 0;
        };

        newPage();

        allBlocks.forEach(block => {
            const bh = estimateBlock(block);
            const maxY = pageHeight - margin;

            // Try to fit in current column
            if (colY[col] + bh <= maxY) {
                colY[col] = renderBlock(block, colX(col), colY[col]);
            } else if (col === 0) {
                // Try right column
                col = 1;
                if (colY[col] + bh <= maxY) {
                    colY[col] = renderBlock(block, colX(col), colY[col]);
                } else {
                    // New page, left column
                    newPage();
                    colY[col] = renderBlock(block, colX(col), colY[col]);
                }
            } else {
                // Both columns exhausted, new page
                newPage();
                colY[col] = renderBlock(block, colX(col), colY[col]);
            }
        });
    } else {
        // --- Normal single-column layout ---
        let y = 20;
        let firstPage = true;

        allBlocks.forEach(block => {
            const bh = estimateBlock(block);

            if (firstPage) {
                firstPage = false;
                y = 20;
            } else if (y + bh > pageHeight - 10) {
                doc.addPage();
                y = 20;
            }

            y = renderBlock(block, margin, y);
        });
    }

    const periodLabel = periodScope === 'all' ? 'all_periods' : `period_${periodScope}`;
    doc.save(`observer_report_${scope === 'all' ? 'all_courses' : scope}_${periodLabel}.pdf`);
  }
};
