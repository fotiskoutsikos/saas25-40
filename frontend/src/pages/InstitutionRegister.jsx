import React, { useState, useEffect } from 'react';
import Header from '../components/Header_Institution';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';

export default function InstitutionForm() {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_email: '',
  });
  const [message, setMessage] = useState('');

  const [courseData, setCourseData] = useState({
    title: '',
    code: '',
    institution_id: '',
    instructor_id: '',
    period: '',
  });
  const [courseMessage, setCourseMessage] = useState('');

  // -----------------------------
  // State για λίστες dropdown
  // -----------------------------
  const [institutions, setInstitutions] = useState([]);
  const [instructors, setInstructors] = useState([]);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:8080/api/institution_service/institutions', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch institutions');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setInstitutions(data);
        }
      })
      .catch(err => {
        console.error('Error loading institutions:', err);
      });

    const fetchInstructors = () => {
      fetch('http://localhost:8080/api/user_service/instructors', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch instructors');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setInstructors(data);
          }
        })
        .catch(err => {
          console.error('Error loading instructors:', err);
        });
    };

    fetchInstructors();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await fetch(
        'http://localhost:8080/api/institution_service/institutions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(formData),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setMessage('Institution registered successfully!');
        setFormData({ name: '', address: '', contact_email: '' });
        setInstitutions(prev => [...prev, data]);
      } else {
        setMessage(data.message || 'Registration failed');
      }
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setMessage('Error: ' + err.message);
      setTimeout(() => setMessage(''), 2500);
    }
  };

  const handleCourseChange = (e) => {
    setCourseData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCourseSubmit = async (e) => {
    e.preventDefault();
    setCourseMessage('');
    if (
      !courseData.title ||
      !courseData.code ||
      !courseData.institution_id ||
      !courseData.period
    ) {
      setCourseMessage('Please fill all fields for Course');
      setTimeout(() => setCourseMessage(''), 2500);
      return;
    }

    const bodyPayload = {
      title: courseData.title,
      code: courseData.code,
      institution_id: courseData.institution_id,
      periods: [courseData.period],
    };
    if (courseData.instructor_id) {
      bodyPayload.instructor_id = courseData.instructor_id;
    }

    try {
      const response = await fetch(
        'http://localhost:8080/api/institution_service/courses',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(bodyPayload),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setCourseMessage(`Course "${data.title}" created (ID: ${data.id})`);
        setCourseData({
          title: '',
          code: '',
          institution_id: '',
          instructor_id: '',
          period: '',
        });
      } else {
        setCourseMessage(data.message || 'Course creation failed');
      }
      setTimeout(() => setCourseMessage(''), 2500);
    } catch (err) {
      setCourseMessage('Error: ' + err.message);
      setTimeout(() => setCourseMessage(''), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Institution Register</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-secondary" htmlFor="name">
              Institution Name
            </label>
            <div>
              <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="box-form"
                placeholder="Name"
              />
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="address">
              Address
            </label>
            <div>
              <input
                type="text"
                name="address"
                id="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="box-form"
                placeholder="Address"
              />
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="contact_email">
              Email
            </label>
            <div>
              <input
                type="email"
                name="contact_email"
                id="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                required
                className="box-form"
                placeholder="example@ntua.gr"
              />
            </div>
          </div>

          <div>
            <button type="submit" className="btn-primary text-button">
              Submit
            </button>
          </div>
        </form>
      </div>


      <div className="box-default mt-6">
        <div className="box-header">
          <div className="text-primary">Create Course</div>
        </div>

        <form onSubmit={handleCourseSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-secondary" htmlFor="title">
              Course Title
            </label>
            <div>
              <input
                type="text"
                name="title"
                id="title"
                value={courseData.title}
                onChange={handleCourseChange}
                required
                className="box-form"
                placeholder="Title"
              />
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="code">
              Course Code
            </label>
            <div>
              <input
                type="text"
                name="code"
                id="code"
                value={courseData.code}
                onChange={handleCourseChange}
                required
                className="box-form"
                placeholder="Code"
              />
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="institution_id">
              Institution
            </label>
            <div>
              <select
                name="institution_id"
                id="institution_id"
                value={courseData.institution_id}
                onChange={handleCourseChange}
                required
                className="box-form"
              >
                <option value="">Institution</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="instructor_id">
              Instructor
            </label>
            <div>
              <select
                name="instructor_id"
                id="instructor_id"
                value={courseData.instructor_id}
                onChange={handleCourseChange}
                className="box-form"
              >
                <option value="">Instructor</option>
                {instructors.map(instr => (
                  <option key={instr.id} value={instr.id}>
                    {instr.username || instr.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-secondary" htmlFor="period">
              Period
            </label>
            <div>
              <select
                name="period"
                id="period"
                value={courseData.period}
                onChange={handleCourseChange}
                required
                className="box-form"
              >
                <option value="">Period</option>
                <option value="Χειμερινό">Χειμερινό</option>
                <option value="Εαρινό">Εαρινό</option>
              </select>
            </div>
          </div>

          <div>
            <button type="submit" className="btn-primary text-button">
              Create Course
            </button>
          </div>
        </form>
      </div>

      {/* -------------------------------
          Κοινό Message Area για τα δύο boxes
      ---------------------------------*/}
      <div className="box-default mt-6">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        <div className="mt-4">
          {message && (
            <div className="text-green-600 font-semibold">{message}</div>
          )}
          {courseMessage && (
            <div className="text-green-600 font-semibold">{courseMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
