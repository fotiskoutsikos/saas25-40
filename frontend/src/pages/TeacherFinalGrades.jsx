import React, { useState, useEffect } from 'react';
import Header from '../components/Header_Teacher';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';

export default function FinalGrades() {
  const [file, setFile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    course: '',
    period: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  // Φέρε τα courses του instructor από το backend
  useEffect(() => {
    fetch('http://localhost:8080/api/institution_service/instructor/courses', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, [token]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!file || !formData.course || !formData.period) {
      setError('Please select file, course, and period.');
      return;
    }
    setLoading(true);

    // Πάρε instructor_id από το token
    let instructorId = '';
    try {
      instructorId = JSON.parse(atob(token.split('.')[1])).id;
    } catch {
      setError('Invalid token');
      setLoading(false);
      return;
    }

    // Πάρε institution_id από το επιλεγμένο course
    const selectedCourseObj = courses.find(c => c.code === formData.course);
    const institutionId = selectedCourseObj ? selectedCourseObj.institution_id : '';

    const data = new FormData();
    data.append('file', file);
    data.append('course_code', formData.course);
    data.append('period', formData.period);
    data.append('year', formData.year);
    data.append('exam_type', formData.exam_type);
    data.append('instructor_id', instructorId);
    data.append('institution_id', institutionId);

    console.log([...data.entries()]);

    try {
      const res = await fetch('http://localhost:8080/api/grading_service/grades/final', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        body: data
      });
      const result = await res.json();
      if (res.ok) {
        setMessage('Final grades uploaded successfully!');
        setFile(null);
        setFormData({ course: '', period: '' });
      } else {
        setError(result.message || 'Upload failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setFormData({ course: '', period: '' });
    setMessage('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      {/* Upload XLSX Box */}
      <div className="box-default max-w-2xl mx-auto mb-6">
        <div className="box-header">
          <div className="text-primary">Upload Final Grades</div>
        </div>
        <form onSubmit={handleConfirm}>
          <div className="text-secondary text-center">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="box-form"
              required
            />
            {file && <p className="mt-2 text-muted">Selected file: {file.name}</p>}
          </div>
          <div className="flex justify-center gap-6 pt-4">
            <button type="submit" className="btn-primary text-button" disabled={loading}>
              {loading ? 'Uploading...' : 'Submit Final Grades'}
            </button>
            <button type="button" onClick={handleCancel} className="btn-primary text-button bg-red-500">
              CANCEL
            </button>
          </div>
        </form>
        {message && <div className="text-green-600 mt-4">{message}</div>}
        {error && <div className="text-red-600 mt-4">{error}</div>}
      </div>

      {/* Form Box */}
      <div className="box-default max-w-2xl mx-auto">
        <div className="box-header">
          <div className="text-primary">Grade Details</div>
        </div>
        <form className="space-y-4 mt-4">
          <div>
            <label htmlFor="course" className="text-secondary">Course</label>
            <div>
              <select
                name="course"
                id="course"
                value={formData.course}
                onChange={handleInputChange}
                required
                className="box-form"
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="period" className="text-secondary">Period</label>
            <div>
              <select
                name="period"
                id="period"
                value={formData.period}
                onChange={handleInputChange}
                required
                className="box-form"
              >
                <option value="">Select Period</option>
                <option value="Χειμερινό">Χειμερινό</option>
                <option value="Εαρινό">Εαρινό</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="year" className="text-secondary">Year</label>
            <div>
              <select
                name="year"
                id="year"
                value={formData.year}
                onChange={handleInputChange}
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
          <div>
            <label htmlFor="exam_type" className="text-secondary">Exam Type</label>
            <div>
              <select
                name="exam_type"
                id="exam_type"
                value={formData.exam_type}
                onChange={handleInputChange}
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
        </form>
      </div>
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

