import React, { useState, useEffect } from 'react';
import Header_Institution from '../components/Header_Institution';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';
import { jwtDecode } from 'jwt-decode';

export default function UserManagementInstitution() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState([]);
  const token = localStorage.getItem('token');
  const userId = token ? jwtDecode(token).id : null;

  useEffect(() => {
    fetch('http://localhost:8080/api/user_service/users', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => setUsers(data));
  }, [token]);

  // Αλλαγή username ή password
  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const response = await fetch(`http://localhost:8080/api/user_service/users/${selectedUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          ...(username && { username }),
          ...(password && { password }),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('User info updated successfully!');
        setUsername('');
        setPassword('');
      } else {
        setError(data.message || 'Update failed');
      }
    } catch {
      setError('Network error');
    }
  };

  // Διαγραφή λογαριασμού
  const handleDelete = async () => {
    setMessage('');
    setError('');
    if (!window.confirm('Are you sure you want to delete your account?')) return;
    try {
      const response = await fetch(`http://localhost:8080/api/user_service/users/${selectedUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Account deleted. You will be logged out.');
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/';
        }, 1500);
      } else {
        setError(data.message || 'Delete failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header_Institution />
      <div className="box-default max-w-lg mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">User Management</div>
        </div>
        <form className="space-y-4 mt-4" onSubmit={handleUpdate}>
          <div>
            <label className="text-secondary" htmlFor="user-select">Select User</label>
            <div>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="box-form"
              >
                <option value="">-- Select User --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-secondary" htmlFor="username">New Username</label>
            <div>
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="box-form"
                placeholder="Enter new username"
              />
            </div>
          </div>
          <div>
            <label className="text-secondary" htmlFor="password">New Password</label>
            <div>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="box-form"
                placeholder="Enter new password"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary text-button">
            Update Info
          </button>
        </form>
        <button
          className="btn-primary text-button mt-6 bg-red-600 hover:bg-red-700"
          onClick={handleDelete}
        >
          Delete Account
        </button>
      </div>
      <div className="box-default max-w-lg mx-auto mt-6">
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