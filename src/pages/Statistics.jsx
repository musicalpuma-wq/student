import { useState, useEffect, useMemo } from 'react';
import { DataStore } from '../services/DataStore';
import { Users, FileSpreadsheet, TrendingUp, Award, AlertTriangle, UserX, BarChart3, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const PASS_THRESHOLD = 3.0;

// Average of a student over promediable activities (mirrors CourseGradebook.calculateAverage)
function computeStudentAvg(student, activities, period) {
    let sum = 0;
    let count = 0;
    activities.forEach(a => {
        if (a.isAveraged === false) return;
        const val = parseFloat((student.grades?.[period] || {})[a.id]);
        if (!isNaN(val)) {
            sum += val;
            count++;
        }
    });
    if (count === 0) return null;
    return sum / count;
}

// Average of an activity across students who have a grade for it
function computeActivityAvg(activity, students, period) {
    let sum = 0;
    let count = 0;
    students.forEach(s => {
        const val = parseFloat((s.grades?.[period] || {})[activity.id]);
        if (!isNaN(val)) {
            sum += val;
            count++;
        }
    });
    if (count === 0) return null;
    return { avg: sum / count, graded: count };
}

function avgColor(avg) {
    if (avg === null || avg === undefined) return 'var(--color-text-primary)';
    if (avg < 3.0) return 'var(--color-danger)';
    if (avg <= 3.9) return '#ff9f0a';
    if (avg <= 4.5) return '#30d158';
    return '#28a745';
}

export function Statistics() {
    const { t, settings } = useSettings();
    const currentPeriod = settings?.currentPeriod || '1';

    const [courses, setCourses] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    // courseData: { [course]: { students, activities } }
    const [courseData, setCourseData] = useState({});

    useEffect(() => {
        const allCourses = DataStore.getCourses();
        setCourses(allCourses);
        setSelectedCourses(allCourses);

        const data = {};
        allCourses.forEach(c => {
            data[c] = {
                students: DataStore.getStudentsByCourse(c),
                activities: DataStore.getActivities(c, currentPeriod)
            };
        });
        setCourseData(data);
    }, [currentPeriod]);

    const toggleCourse = (course) => {
        setSelectedCourses(prev =>
            prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
        );
    };

    const stats = useMemo(() => {
        const perCourse = [];
        let totalStudents = 0;
        let gradedActivities = 0;
        let totalActivities = 0;
        let gradedCells = 0;
        let possibleCells = 0;
        const studentAverages = []; // { name, course, avg }
        const activityAverages = []; // { name, course, avg, graded }
        let studentsWithoutGrades = 0;

        selectedCourses.forEach(course => {
            const data = courseData[course];
            if (!data) return;
            const { students, activities } = data;
            const promediable = activities.filter(a => a.isAveraged !== false);

            const courseAvgs = [];
            let courseNoGrades = 0;
            students.forEach(s => {
                const avg = computeStudentAvg(s, activities, currentPeriod);
                if (avg === null) courseNoGrades++;
                else {
                    courseAvgs.push(avg);
                    studentAverages.push({ name: s.name, course, avg });
                }
            });

            let courseGradedActivities = 0;
            promediable.forEach(a => {
                const res = computeActivityAvg(a, students, currentPeriod);
                possibleCells += students.length;
                if (res) {
                    courseGradedActivities++;
                    gradedCells += res.graded;
                    activityAverages.push({ name: a.name, course, avg: res.avg, graded: res.graded });
                }
            });

            const courseAvg = courseAvgs.length > 0
                ? courseAvgs.reduce((a, b) => a + b, 0) / courseAvgs.length
                : null;
            const passing = courseAvgs.filter(a => a >= PASS_THRESHOLD).length;
            const best = courseAvgs.length > 0
                ? studentAverages.filter(sa => sa.course === course).sort((a, b) => b.avg - a.avg)[0]
                : null;

            totalStudents += students.length;
            gradedActivities += courseGradedActivities;
            totalActivities += promediable.length;
            studentsWithoutGrades += courseNoGrades;

            perCourse.push({
                course,
                students: students.length,
                activities: promediable.length,
                avg: courseAvg,
                passRate: courseAvgs.length > 0 ? (passing / courseAvgs.length) * 100 : null,
                best
            });
        });

        const overallAvg = studentAverages.length > 0
            ? studentAverages.reduce((a, b) => a + b.avg, 0) / studentAverages.length
            : null;
        const passingTotal = studentAverages.filter(sa => sa.avg >= PASS_THRESHOLD).length;
        const passRate = studentAverages.length > 0 ? (passingTotal / studentAverages.length) * 100 : null;
        const bestStudent = studentAverages.length > 0
            ? [...studentAverages].sort((a, b) => b.avg - a.avg)[0]
            : null;
        const lowPerformers = studentAverages
            .filter(sa => sa.avg < PASS_THRESHOLD)
            .sort((a, b) => a.avg - b.avg);

        const sortedActivities = [...activityAverages].sort((a, b) => a.avg - b.avg);
        const hardest = sortedActivities.slice(0, 3);
        const easiest = [...sortedActivities].reverse().slice(0, 3);

        const distribution = [
            { label: '< 3.0', color: 'var(--color-danger)', count: studentAverages.filter(sa => sa.avg < 3.0).length },
            { label: '3.0 – 3.9', color: '#ff9f0a', count: studentAverages.filter(sa => sa.avg >= 3.0 && sa.avg <= 3.9).length },
            { label: '4.0 – 4.5', color: '#30d158', count: studentAverages.filter(sa => sa.avg > 3.9 && sa.avg <= 4.5).length },
            { label: '> 4.5', color: '#28a745', count: studentAverages.filter(sa => sa.avg > 4.5).length }
        ];

        return {
            perCourse,
            totalStudents,
            gradedActivities,
            totalActivities,
            gradedCells,
            possibleCells,
            overallAvg,
            passRate,
            bestStudent,
            lowPerformers,
            hardest,
            easiest,
            distribution,
            studentsWithoutGrades,
            studentsWithGrades: studentAverages.length
        };
    }, [selectedCourses, courseData, currentPeriod]);

    const cardStyle = { display: 'flex', alignItems: 'center', gap: '1rem' };
    const iconBubble = (color) => ({
        padding: '0.8rem',
        background: 'var(--color-bg-secondary)',
        color,
        borderRadius: '50%',
        flexShrink: 0
    });

    return (
        <div>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', letterSpacing: '-0.5px' }}>{t('statisticsTitle')}</h1>
                <p style={{ color: 'var(--color-text-secondary)' }}>{t('period')} {currentPeriod}</p>
            </header>

            {/* Course selection */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{t('coursesToAnalyze')}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setSelectedCourses(courses)}>{t('selectAll')}</button>
                        <button className="btn btn-secondary" onClick={() => setSelectedCourses([])}>{t('selectNone')}</button>
                    </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {courses.map(c => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                            <input
                                type="checkbox"
                                checked={selectedCourses.includes(c)}
                                onChange={() => toggleCourse(c)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            {c}
                        </label>
                    ))}
                </div>
            </div>

            {selectedCourses.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                    {t('noCoursesSelected')}
                </div>
            ) : (
                <>
                    {/* Metric cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2rem'
                    }}>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble('var(--color-accent)')}><Users size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('studentsCount')}</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.totalStudents}</p>
                            </div>
                        </div>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble('var(--color-accent)')}><FileSpreadsheet size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('gradedActivities')}</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>
                                    {stats.gradedActivities}<span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}> / {stats.totalActivities}</span>
                                </p>
                                {stats.possibleCells > 0 && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {Math.round((stats.gradedCells / stats.possibleCells) * 100)}% {t('gradedCells')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble(avgColor(stats.overallAvg))}><TrendingUp size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('overallAverage')}</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 700, color: avgColor(stats.overallAvg) }}>
                                    {stats.overallAvg !== null ? stats.overallAvg.toFixed(1) : '-'}
                                </p>
                            </div>
                        </div>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble('var(--color-success)')}><CheckCircle2 size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('passRate')}</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>
                                    {stats.passRate !== null ? `${Math.round(stats.passRate)}%` : '-'}
                                </p>
                            </div>
                        </div>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble('#28a745')}><Award size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('bestStudent')}</p>
                                {stats.bestStudent ? (
                                    <>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stats.bestStudent.name}</p>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                            {stats.bestStudent.course} • <span style={{ color: avgColor(stats.bestStudent.avg), fontWeight: 700 }}>{stats.bestStudent.avg.toFixed(1)}</span>
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>-</p>
                                )}
                            </div>
                        </div>
                        <div className="card" style={cardStyle}>
                            <div style={iconBubble('var(--color-warning)')}><UserX size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t('studentsWithoutGrades')}</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.studentsWithoutGrades}</p>
                            </div>
                        </div>
                    </div>

                    {/* Lists: low performers + distribution */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <AlertTriangle size={20} color="var(--color-danger)" />
                                {t('lowPerformers')}
                            </h3>
                            {stats.lowPerformers.length === 0 ? (
                                <p style={{ color: 'var(--color-text-secondary)' }}>{t('noLowPerformers')}</p>
                            ) : (
                                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                                    {stats.lowPerformers.map((s, i) => (
                                        <div key={`${s.course}-${s.name}-${i}`} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '0.5rem 0',
                                            borderBottom: '1px solid var(--color-border)'
                                        }}>
                                            <span>{s.name} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>({s.course})</span></span>
                                            <strong style={{ color: 'var(--color-danger)' }}>{s.avg.toFixed(1)}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <BarChart3 size={20} color="var(--color-accent)" />
                                {t('gradeDistribution')}
                            </h3>
                            {stats.studentsWithGrades === 0 ? (
                                <p style={{ color: 'var(--color-text-secondary)' }}>{t('noGradesYet')}</p>
                            ) : (
                                stats.distribution.map(d => (
                                    <div key={d.label} style={{ marginBottom: '0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 600 }}>{d.label}</span>
                                            <span>{d.count} ({Math.round((d.count / stats.studentsWithGrades) * 100)}%)</span>
                                        </div>
                                        <div style={{ height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${(d.count / stats.studentsWithGrades) * 100}%`,
                                                background: d.color,
                                                borderRadius: '4px',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Lists: hardest + easiest activities */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', color: 'var(--color-danger)' }}>{t('hardestActivities')}</h3>
                            {stats.hardest.length === 0 ? (
                                <p style={{ color: 'var(--color-text-secondary)' }}>{t('noActivitiesGraded')}</p>
                            ) : (
                                stats.hardest.map((a, i) => (
                                    <div key={`h-${a.course}-${a.name}-${i}`} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid var(--color-border)'
                                    }}>
                                        <span>{a.name} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>({a.course})</span></span>
                                        <strong style={{ color: avgColor(a.avg) }}>{a.avg.toFixed(1)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', color: '#28a745' }}>{t('easiestActivities')}</h3>
                            {stats.easiest.length === 0 ? (
                                <p style={{ color: 'var(--color-text-secondary)' }}>{t('noActivitiesGraded')}</p>
                            ) : (
                                stats.easiest.map((a, i) => (
                                    <div key={`e-${a.course}-${a.name}-${i}`} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid var(--color-border)'
                                    }}>
                                        <span>{a.name} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>({a.course})</span></span>
                                        <strong style={{ color: avgColor(a.avg) }}>{a.avg.toFixed(1)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Course comparison table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <h3 style={{ padding: '1.5rem 1.5rem 0' }}>{t('courseComparison')}</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.8rem 1.5rem' }}>{t('courseLabel')}</th>
                                        <th style={{ padding: '0.8rem', textAlign: 'center' }}>{t('studentsCount')}</th>
                                        <th style={{ padding: '0.8rem', textAlign: 'center' }}>{t('activitiesCount')}</th>
                                        <th style={{ padding: '0.8rem', textAlign: 'center' }}>{t('overallAverage')}</th>
                                        <th style={{ padding: '0.8rem', textAlign: 'center' }}>{t('approval')}</th>
                                        <th style={{ padding: '0.8rem 1.5rem' }}>{t('bestStudent')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.perCourse.map(c => (
                                        <tr key={c.course} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '0.8rem 1.5rem', fontWeight: 600 }}>{c.course}</td>
                                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>{c.students}</td>
                                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>{c.activities}</td>
                                            <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 700, color: avgColor(c.avg) }}>
                                                {c.avg !== null ? c.avg.toFixed(1) : '-'}
                                            </td>
                                            <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                                {c.passRate !== null ? `${Math.round(c.passRate)}%` : '-'}
                                            </td>
                                            <td style={{ padding: '0.8rem 1.5rem' }}>
                                                {c.best ? `${c.best.name} (${c.best.avg.toFixed(1)})` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
