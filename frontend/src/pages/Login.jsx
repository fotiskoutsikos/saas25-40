import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Header from '../components/Header_Login';
import '../components/textStyles.css';
import '../components/boxStyles.css';
import '../components/buttonStyles.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const response = await fetch('http://localhost:8080/api/user_service/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      console.log("Login response:", data);
      if (response.ok) {
        localStorage.setItem('token', data.token);
        // decode το token για να βρεις το ρόλο
        const decoded = jwtDecode(data.token);
        const role = decoded.role;

        setMessage('Login successful!');
        if (role === 'STUDENT') navigate('/studentmygrades');
        else if (role === 'INSTRUCTOR') navigate('/teachermycourses');
        else if (role === 'INSTITUTION_REP') navigate('/institution');
        else navigate('/');
      } else {
        setError(data.message || 'Login failed');
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
          <div className="text-primary">Please enter your credentials</div>
        </div>
        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div>
              <label htmlFor="username" className="text-secondary">
                Username
              </label>
            </div>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="box-form"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <div>
              <label htmlFor="password" className="text-secondary">
                Password
              </label>
            </div>
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
            <button type="submit" className="btn-primary text-button">
              Login
            </button>
            <label className="text-secondary">or </label>
            <button
              type="button"
              className="btn-primary text-button"
              onClick={() => navigate('/register')}
            >
              Create Account
            </button>
          </div>
        </form>
        {/* Message Area */}
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
