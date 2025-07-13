import React, { useEffect, useState } from 'react';
import Header from '../components/Header_Teacher';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

export default function TeacherMyCourses() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseObj, setSelectedCourseObj] = useState(null);
  const [periodDates, setPeriodDates] = useState([]);
  const [stats, setStats] = useState(null);
  const token = localStorage.getItem('token');
  const [message] = useState('');
  const [error] = useState('');

  // Fetch courses
  useEffect(() => {
    fetch('http://localhost:8080/api/institution_service/instructor/courses', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, [token]);

  // Update selectedCourseObj
  useEffect(() => {
    setSelectedCourseObj(courses.find(c => c.code === selectedCourse) || null);
  }, [selectedCourse, courses]);

  // Fetch initial/final dates
  useEffect(() => {
    if (!selectedCourseObj) {
      setPeriodDates([]);
      return;
    }

    const fetchDates = async () => {
  try {
    const [resInit, resFinal] = await Promise.all([
      fetch(`http://localhost:8080/api/grading_service/grades/initial/${selectedCourseObj.code}`, {
        headers: { Authorization: 'Bearer ' + token }
      }),
      fetch(`http://localhost:8080/api/grading_service/grades/final/${selectedCourseObj.code}`, {
        headers: { Authorization: 'Bearer ' + token }
      })
    ]);

    const initialData = resInit.ok ? await resInit.json() : [];
    const finalData = resFinal.ok ? await resFinal.json() : [];

    if (!Array.isArray(initialData) || !Array.isArray(finalData)) {
      throw new Error("One or both responses are not arrays.");
    }

    const combined = {};

    for (const sheet of initialData) {
      const key = `${sheet.year}-${sheet.exam_type}`;
      combined[key] = {
        year: sheet.year,
        exam_type: sheet.exam_type,
        initialDate: sheet.created_at,
        finalDate: null
      };
    }

    for (const sheet of finalData) {
      const key = `${sheet.year}-${sheet.exam_type}`;
      if (combined[key]) {
        combined[key].finalDate = sheet.created_at;
      } else {
        combined[key] = {
          year: sheet.year,
          exam_type: sheet.exam_type,
          initialDate: null,
          finalDate: sheet.created_at
        };
      }
    }

    setPeriodDates(Object.values(combined));
  } catch (err) {
    console.error('Error fetching dates:', err);
    setPeriodDates([]);
  }
};

    fetchDates();
  }, [selectedCourseObj, token]);

  const fetchStatsForPeriod = async (year, examType) => {
    if (!selectedCourseObj) return;

    try {
     const res = await fetch(
        `http://localhost:8080/api/grading_service/grades/stats/${selectedCourseObj.code}?year=${year}&exam_type=${encodeURIComponent(examType)}`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      );
      const data = await res.json();
      setStats(data || null);
    } catch (err) {
      console.error('Failed to fetch stats', err);
      setStats(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />
      <div className="box-default max-w-4xl mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">My Courses Statistics</div>
        </div>
        <div className="mb-4">
          <label className="text-secondary">Course</label>
          <select
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            className="box-form w-full"
          >
            <option value="">Select a Course</option>
            {courses.map((course, idx) => (
              <option key={idx} value={course.code}>
                {course.title} ({course.code})
              </option>
            ))}
          </select>
        </div>

        {selectedCourseObj && (
          <table className="w-full mt-4 text-left border-collapse">
            <thead>
              <tr className="text-secondary border-b border-gray-400">
                <th className="p-2">Year</th>
                <th className="p-2">Exam Type</th>
                <th className="p-2">Initial Submission</th>
                <th className="p-2">Final Submission</th>
                <th className="p-2">Stats</th>
              </tr>
            </thead>
            <tbody>
              {periodDates.map(({ year, exam_type, initialDate, finalDate }, idx) => (
                <tr key={idx} className="text-secondary">
                  <td className="p-2">{year}</td>
                  <td className="p-2">{exam_type}</td>
                  <td className="p-2">{initialDate ? new Date(initialDate).toLocaleString() : '—'}</td>
                  <td className="p-2">{finalDate ? new Date(finalDate).toLocaleString() : '—'}</td>
                  <td className="p-2">
                    <button
                      className="btn-primary text-button"
                      onClick={() => fetchStatsForPeriod(year, exam_type)}
                    >
                      Show Statistics
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

       {selectedCourseObj && stats && (
        <div className="box-default max-w-4xl mx-auto mt-6">
          <div className="box-header">
            <div className="text-primary">Statistics Diagram</div>
          </div>
          <div className="mt-4">
            <div className="text-primary mb-2">
              Grade Distribution{' '}
              {stats.overall_stats?.avg !== undefined && stats.overall_stats?.avg !== null && (
                <span className="ml-4 text-secondary">
                  (Average: {stats.overall_stats.avg.toFixed(2)})
                </span>
              )}
            </div>
            {stats.overall_stats?.distribution && Object.keys(stats.overall_stats.distribution).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(stats.overall_stats.distribution).map(([grade, count]) => ({
                    grade,
                    count
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-secondary mt-4">No distribution data available.</div>
            )}
          </div>
        </div>
      )}

      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        <div className="mt-4">
          {error && <div className="text-red-600">{error}</div>}
          {message && <div className="text-green-600">{message}</div>}
        </div>
      </div>
    </div>
  );
}
