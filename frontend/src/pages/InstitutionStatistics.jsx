import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Header from '../components/Header_Institution';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function InstitutionStatistics() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [year, setYear] = useState('');
  const [examType, setExamType] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  let institutionId = '';

  try {
    institutionId = jwtDecode(token).institution_id;
  } catch {
    institutionId = '';
  }

  useEffect(() => {
    if (!institutionId) return;
    fetch('http://localhost:8080/api/institution_service/institution/courses', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, [token, institutionId]);

  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
    setYear('');
    setExamType('');
    setStats(null);
    setError('');
  };

const handleYearChange = (e) => {
    setYear(e.target.value);
    setStats(null);
    setError('');
  };

  const handleExamTypeChange = (e) => {
    setExamType(e.target.value);
    setStats(null);
    setError('');
  };


  const handleShowStats = async () => {
    if (!selectedCourse) {
      setError('Please select a course.');
      return;
    }
    setLoading(true);
    setStats(null);
    setError('');
    try {
      const res = await fetch(`http://localhost:8080/api/grading_service/grades/stats/${selectedCourse}?year=${year}&exam_type=${encodeURIComponent(examType)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data); // όλο το αντικείμενο, όχι μόνο overall_stats
      } else {
        setError(data.message || 'Could not fetch statistics');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-8">
        <Header />
        <div className="box-default max-w-4xl mx-auto mt-6">
          <div className="text-red-600">Δεν είστε συνδεδεμένος με κάποιο ίδρυμα. Επικοινωνήστε με τον διαχειριστή.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      <div className="box-default max-w-4xl mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">Course Statistics</div>
        </div>

        <form className="space-y-4 mt-4" onSubmit={e => { e.preventDefault(); handleShowStats(); }}>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="course" className="text-secondary">Course</label>
              <select
                name="course"
                id="course"
                value={selectedCourse}
                onChange={handleCourseChange}
                required
                className="box-form w-full"
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="year" className="text-secondary">Year</label>
            <div>
              <select
                name="year"
                id="year"
                value={year}
                onChange={handleYearChange}
                required
                className="box-form"
              >
                <option value="">Select Year</option>
                {[...Array(6)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="exam_type" className="text-secondary">Exam Type</label>
            <div>
              <select
                name="exam_type"
                id="exam_type"
                value={examType}
                onChange={handleExamTypeChange}
                required
                className="box-form"
              >
                <option value="">Select Exam Type</option>
                <option value="Κανονική">Κανονική</option>
                <option value="Επαναληπτική">Επαναληπτική</option>
                <option value="Επι Πτυχίω">Επι Πτυχίω</option>
              </select>
            </div>
          </div>
          </div>
          <button type="submit" className="btn-primary text-button mt-4" disabled={loading}>
            {loading ? 'Loading...' : 'Show Statistics'}
          </button>
        </form>

        {stats?.overall_stats && (
          <div className="mt-8">
            <div className="mb-2">
              <span className="text-secondary font-bold">Συνολική Βαθμολογία </span>
              {stats.overall_stats.avg !== undefined && (
                <span className="ml-4 text-secondary">
                  (Average: {stats.overall_stats.avg.toFixed(2)})
                </span>
              )}
            </div>
            {stats.overall_stats.distribution && Object.keys(stats.overall_stats.distribution).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(stats.overall_stats.distribution).map(([grade, count]) => ({ grade, count }))}>
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
        )}

        {stats?.questions_stats && Object.entries(stats.questions_stats).map(([qKey, qStats]) => (
          <div key={qKey} className="mt-8">
            <div className="mb-2">
              <span className="text-secondary font-bold">
                Ερώτημα {qKey.replace(/^Q0?/, '')}
              </span>
              {qStats.avg !== undefined && (
                <span className="ml-4 text-secondary">
                  (Average: {qStats.avg.toFixed(2)})
                </span>
              )}
            </div>
            {qStats.distribution && Object.keys(qStats.distribution).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(qStats.distribution).map(([grade, count]) => ({ grade, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-secondary mt-4">No distribution data available.</div>
            )}
          </div>
        ))}
      </div>

      {/* Message Area */}
      <div className="box-default max-w-4xl mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        {error && (
          <div className="mt-4">
            <div className="text-red-600">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
