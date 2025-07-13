import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Header from '../components/Header_Login';
import '../components/textStyles.css';
import '../components/boxStyles.css';
import '../components/buttonStyles.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [studentCode, setStudentCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:8080/api/institution_service/institutions/public')
      .then(res => res.ok ? res.json() : [])
      .then(data => setInstitutions(Array.isArray(data) ? data : []))
      .catch(() => setInstitutions([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const payload = { username, email, password, role };
    if (institutionId) payload.institution_id = institutionId;
    if (role === 'STUDENT') payload.student_code = studentCode;
    try {
      const response = await fetch('http://localhost:8080/api/user_service/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user_id', data.id);
        setMessage('Registration successful!');
        // Αυτόματο login: redirect ανάλογα με το ρόλο
        const decoded = jwtDecode(data.token);
        const userRole = decoded.role;
        if (userRole === 'STUDENT') navigate('/studentmygrades');
        else if (userRole === 'INSTRUCTOR') navigate('/teachermycourses');
        else if (userRole === 'INSTITUTION_REP') navigate('/institutionaccounts');
        else navigate('/');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />
      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Create Account</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="text-secondary">Username</label>
            <br />
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="box-form"
              placeholder="username"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-secondary">Email</label>
            <br />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="box-form"
              placeholder="example@mail.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-secondary">Password</label>
            <br />
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="box-form"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label htmlFor="role" className="text-secondary">Role</label>
            <br />
            <select
              id="role"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="box-form"
              required
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Teacher</option>
              <option value="INSTITUTION_REP">Institution Representative</option>
            </select>
          </div>
          {/* Institution dropdown πάνω από το student code */}
          <div>
            <label htmlFor="institution" className="text-secondary">Institution</label>
            <br />
            <select
              id="institution"
              required={role !== "INSTITUTION_REP"}
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              className="box-form"
            >
              <option value="">
                {role === "INSTITUTION_REP"
                  ? "No institution (for first representative)"
                  : "Select institution"}
              </option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          {role === 'STUDENT' && (
            <div>
              <label htmlFor="student_code" className="text-secondary">Student Code (Αριθμός Μητρώου)</label>
              <br />
              <input
                id="student_code"
                type="text"
                required
                value={studentCode}
                onChange={e => setStudentCode(e.target.value)}
                className="box-form"
                placeholder="031xxxxx"
              />
            </div>
          )}
          <div>
            <button type="submit" className="btn-primary text-button">
              Register
            </button>
            <label className="text-secondary"> or </label>
            <button
              type="button"
              className="btn-primary text-button"
              onClick={() => navigate('/')}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        {(message || error) && (
          <div className="mt-4">
            {message && <div className="text-green-600">{message}</div>}
            {error && <div className="text-red-600">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}