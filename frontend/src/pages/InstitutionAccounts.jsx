import React, { useState } from 'react';
import Header from '../components/Header_Institution';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';

export default function InstitutionUserManagement() {
  // State για create user
  const [createUserData, setCreateUserData] = useState({
    userType: '',
    fullName: '',
    email: '',
    id: '',
    password: '',
  });
  // State για change password
  const [changePwdData, setChangePwdData] = useState({
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  let myInstitutionId = '';

  try {
    myInstitutionId = JSON.parse(atob(token.split('.')[1])).institution_id;
  } catch {
    myInstitutionId = '';
  }

  // Handlers για κάθε φόρμα
  const handleCreateUserChange = (e) => {
    setCreateUserData({
      ...createUserData,
      [e.target.name]: e.target.value,
    });
  };
  const handleChangePwdChange = (e) => {
    setChangePwdData({
      ...changePwdData,
      [e.target.name]: e.target.value,
    });
  };

  // Δημιουργία χρήστη
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    let role = '';
    if (createUserData.userType === 'institution_manager') role = 'INSTITUTION_REP';
    else if (createUserData.userType === 'teacher') role = 'INSTRUCTOR';
    else if (createUserData.userType === 'student') role = 'STUDENT';

    const payload = {
      username: createUserData.email,
      email: createUserData.email,
      password: createUserData.password,
      role,
      institution_id: myInstitutionId, // <-- παίρνουμε institution_id από το token
      ...(role === 'STUDENT' && { student_code: createUserData.id }),
    };

    try {
      const response = await fetch('http://localhost:8080/api/user_service/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('User created successfully!');
        setCreateUserData({ userType: '', fullName: '', email: '', id: '', password: '' });
      } else {
        setError(data.message || 'User creation failed');
      }
    } catch {
      setError('Network error');
    }
  };

  // Αλλαγή password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!changePwdData.username || !changePwdData.password) {
      setError('Username and new password required');
      return;
    }
    try {
      // 1. Βρες το id του χρήστη με βάση το username
      const userRes = await fetch(`http://localhost:8080/api/user_service/users?username=${encodeURIComponent(changePwdData.username)}`, {
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });
      const userData = await userRes.json();
      if (!userRes.ok || !userData.id) {
        setError('User not found');
        return;
      }
      const userId = userData.id;

      // 2. Κάνε PUT για αλλαγή password
      const response = await fetch(`http://localhost:8080/api/user_service/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          password: changePwdData.password,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Password changed successfully!');
        setChangePwdData({ ...changePwdData, password: '' });
      } else {
        setError(data.message || 'Password change failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      {/* Create User */}
      <div className="box-default max-w-lg mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">Create New User Account</div>
        </div>
        <form className="space-y-4 mt-4" onSubmit={handleCreateUser}>
          <div>
            <label className="text-secondary" htmlFor="userType">Type</label>
            <div>
              <select
                id="userType"
                name="userType"
                value={createUserData.userType}
                onChange={handleCreateUserChange}
                required
                className="box-form"
              >
                <option value="">Select User Type</option>
                <option value="institution_manager">Institution representative</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-secondary" htmlFor="fullName">Name</label>
            <div>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={createUserData.fullName}
                onChange={handleCreateUserChange}
                required
                className="box-form"
                placeholder="User full name"
              />
            </div>
          </div>
          <div>
            <label className="text-secondary" htmlFor="email">Email</label>
            <div>
              <input
                type="email"
                id="email"
                name="email"
                value={createUserData.email}
                onChange={handleCreateUserChange}
                required
                className="box-form"
                placeholder="user@example.com"
              />
            </div>
          </div>
          {/* Εμφανίζεται μόνο αν είναι student */}
          {createUserData.userType === 'student' && (
            <div>
              <label className="text-secondary" htmlFor="id">ID</label>
              <div>
                <input
                  type="text"
                  id="id"
                  name="id"
                  value={createUserData.id}
                  onChange={handleCreateUserChange}
                  required
                  className="box-form"
                  placeholder="031xxxxx ή άλλο μοναδικό"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-secondary" htmlFor="password">Password</label>
            <div>
              <input
                type="password"
                id="password"
                name="password"
                value={createUserData.password}
                onChange={handleCreateUserChange}
                required
                className="box-form"
                placeholder="Enter password"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary text-button">
            Create User
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="box-default max-w-lg mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">Change User Password</div>
        </div>
        <form className="space-y-4 mt-4" onSubmit={handleChangePassword}>
          <div>
            <label className="text-secondary" htmlFor="username">Username</label>
            <div>
              <input
                type="text"
                id="username"
                name="username"
                value={changePwdData.username}
                onChange={handleChangePwdChange}
                required
                className="box-form"
                placeholder="username"
              />
            </div>
          </div>
          <div>
            <label className="text-secondary" htmlFor="password">New Password</label>
            <div>
              <input
                type="password"
                id="new_password"
                name="password"
                value={changePwdData.password}
                onChange={handleChangePwdChange}
                required
                className="box-form"
                placeholder="Enter new password"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary text-button">
            Change Password
          </button>
        </form>
      </div>

      {/* Message Area */}
      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        {(message || error) && (
          <div className="mt-4">
            {message && (
              <div className="text-green-600 font-semibold">{message}</div>
            )}
            {error && (
              <div className="text-red-600 font-semibold">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
