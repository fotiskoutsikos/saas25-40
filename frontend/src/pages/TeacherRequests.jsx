import React, { useState, useEffect } from 'react';
import Header from '../components/Header_Teacher';
import '../components/boxStyles.css';
import '../components/buttonStyles.css';
import '../components/textStyles.css';

export default function ReviewRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReply, setActiveReply] = useState(null);
  const [formData, setFormData] = useState({
    action: '',
    message: '',
    attachment: null,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [courses, setCourses] = useState([]);

  const token = localStorage.getItem('token');

  // Fetch instructor courses
  useEffect(() => {
    fetch('http://localhost:8080/api/institution_service/instructor/courses', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, [token]);

  // Fetch and filter review requests
  useEffect(() => {
    setLoading(true);
    console.log("Token used for review fetch:", token);
    fetch('http://localhost:8080/api/review_service/reviews', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch review requests');
        return res.json();
      })
      .then(data => {
        const instructorCourseCodes = courses.map(c => c.code);
        const filtered = data.filter(req => instructorCourseCodes.includes(req.course_code));
        const result = filtered
        .filter(req=> req.status !== 'ADDRESSED')
        .map(req => {
          const course = courses.find(c => c.code === req.course_code);
          return {
            ...req,
            course_title: course ? course.title : req.course_code
          };
        });
        setRequests(Array.isArray(result) ? result : []);
        setError('');
      })
      .catch(() => {
        setRequests([]);
        setError('Could not load review requests');
      })
      .finally(() => setLoading(false));
  }, [token, courses]);

  const handleReplyClick = (id) => {
    setActiveReply(id);
    setFormData({ action: '', message: '', attachment: null });
    setSuccess('');
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e, req) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const body = new FormData();
    body.append('action', formData.action);
    body.append('message', formData.message);
    if (formData.attachment) body.append('attachment', formData.attachment);
    body.append('new_grade', formData.new_grade || '');

    try {
      const res = await fetch(`http://localhost:8080/api/review_service/reviews/${req.id}/reply`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body,
      });
      if (res.ok) {
        setSuccess('Reply submitted!');
        setActiveReply(null);
        // Optionally, refresh requests
        setRequests(requests => requests.filter(r => r.id !== req.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Failed to submit reply');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      <div className="box-default max-w-5xl mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">Grade Review Requests</div>
        </div>

        {loading ? (
          <div className="p-4">Loading...</div>
        ) : (
          <table className="w-full mt-4 text-left border-collapse">
            <thead>
              <tr className="text-secondary border-b border-gray-400">
                <th className="p-2">Course</th>
                <th className="p-2">Exam Period</th>
                <th className="p-2">Student</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-secondary text-center py-4">
                    No review requests found.
                  </td>
                </tr>
              )}
              {requests.map((req) => (
                <React.Fragment key={req.id}>
                  <tr className="text-secondary border-b">
                    <td className="p-2">{req.course_title}</td>
                    <td className="p-2">{req.period}</td>
                    <td className="p-2">{req.student_name || req.student || req.student_code}</td>
                    <td className="p-2">{req.reason || req.message}</td>
                    <td className="p-2">
                      <button
                        className="btn text-button"
                        onClick={() => handleReplyClick(req.id)}
                      >
                        Reply
                      </button>
                    </td>
                  </tr>
                  {activeReply === req.id && (
                    <tr>
                      <td colSpan="5" className="box-default">
                        <form onSubmit={e => handleSubmit(e, req)}>
                          <div>
                            <label className="text-secondary">Action</label>
                            <div>
                              <select
                                name="action"
                                required
                                value={formData.action}
                                onChange={handleChange}
                                className="box-form"
                              >
                                <option value="">Select...</option>
                                <option value="accept">Total accept</option>
                                <option value="partial">Partial accept</option>
                                <option value="reject">Reject</option>
                              </select>
                            </div>
                          </div>
                          {formData.action === 'partial'|| formData.action =='accept' && (
                            <div>
                              <label className="text-secondary">New Grade</label>
                              <div>
                                <input
                                  type="number"
                                  name="new_grade"
                                  min="0"
                                  max="10"
                                  value={formData.new_grade || ''}
                                  onChange={handleChange}
                                  className="box-form"
                                  placeholder="Enter new grade"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-secondary">Instructor's Message</label>
                            <div>
                              <textarea
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                className="box-form"
                                rows={4}
                                placeholder="Your response..."
                              ></textarea>
                            </div>
                          </div>

                          <div>
                            <input
                              type="file"
                              name="attachment"
                              onChange={handleChange}
                            />
                            <button type="submit" className="btn-sameline text-button">
                              Upload Reply Attachment
                            </button>
                          </div>
                          {success && <div className="text-green-600">{success}</div>}
                          {error && <div className="text-red-600">{error}</div>}
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="box-default">
        <div className="box-header">
          <div className="text-primary">Message Area</div>
        </div>
        {(error || success) && (
          <div className="mt-4">
            {error && <div className="text-red-600">{error}</div>}
            {success && <div className="text-green-600">{success}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
