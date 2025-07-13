import React, { useEffect, useState } from 'react';
import Header from '../components/Header_Student';
import '../components/boxStyles.css';
import '../components/buttonStyles.css';
import '../components/textStyles.css';

// Helper to decode JWT and get studentId
function getStudentIdFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.studentId || localStorage.getItem('user_id');
  } catch {
    return localStorage.getItem('user_id');
  }
}

export default function MyGradesPage() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeIdx, setSelectedGradeIdx] = useState(null);
  const [error, setError] = useState(null);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [submittedStatus, setSubmittedStatus] = useState({});
  const [showReviewForCourse, setShowReviewForCourse] = useState(null);
  const [courseNames, setCourseNames] = useState({});



  const [reviewResult, setReviewResult] = useState(null);
  const [loadingReviewResult, setLoadingReviewResult] = useState(false);
  const [reviewResultError, setReviewResultError] = useState(null);

  

  const token = localStorage.getItem('token');
  const studentId = getStudentIdFromToken(token);

  const hasReviewForCourse = (courseCode) => {
    return reviews.some(r => r.course_code === courseCode && r.student_code === studentCode);
  };

  // Fetch student code
  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:8080/api/user_service/users/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.ok ? res.json() : {})
      .then(data => setStudentCode(data.student_code || ''));
  }, [token]);

useEffect(() => {
  if (studentCode) {
    fetchReviewRequests();
  }
}, [studentCode]);

  // Fetch grades on mount (calls the actual backend endpoint you have)
  useEffect(() => {
    if (!studentId || !token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log("Token used for grades fetch:", token);
    fetch('http://localhost:8080/api/grading_service/student/grades', {
      method: 'GET',
      headers:
        {
          'Authorization': 'Bearer ' + token
          // ΜΗΝ βάζεις 'Content-Type' για GET!
        }
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to fetch grades');
        }
        return res.json();
      })
      .then((data) => {
        // Adapt the backend format to the UI format if needed
        // Example: [{course_code, grade_value, remarks}]
        setGrades(
          Array.isArray(data)
            ? data.map((g) => ({
                entry_id: g.entry_id,
                course: g.course_code || g.course_id || '—',
                course_code: g.course_code || g.course_id || '', // <-- ΠΡΟΣΘΕΣΕ αυτό!
                year: g.year || '—',
                exam_type: g.exam_type || '—',
                period: g.period || '—',
                grade_status: g.grade_status || '-', // You can adjust this if you have status info
                grade: {
                  total: g.grade_value,
                  questions: g.questions || []
                },
                remarks: g.remarks || '',
                reviewRequested: false // No review logic in backend yet
              }))
            : []
        );
        setError(null);
      })
      .catch((err) => {
        setGrades([]);
        setError(err.message || 'Failed to fetch grades');
      })
      .finally(() => setLoading(false));
  }, [studentId, token]);




  useEffect(() => {
  if (!token) return;

  fetch('http://localhost:8080/api/institution_service/courses', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json();
    })
    .then(data => {
      const map = {};
      data.forEach(c => {
        map[c.code] = c.title;
      });
      setCourseNames(map);
    })
    .catch(err => {
      console.error('Error fetching courses:', err);
    });
}, [token]);




    // Function to fetch review requests on demand
  const fetchReviewRequests = () => {
    if (!token || !studentCode) return;
    setReviewLoading(true);
    fetch(`http://localhost:8080/api/review_service/reviews?student_code=${encodeURIComponent(studentCode)}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        console.log("Review data from backend:", data);
        setReviews(data);
        const reviewMap = new Map();
        for (const review of data) {
          reviewMap.set(review.entry_id, true);
        }
        setGrades(prevGrades =>
          prevGrades.map(g => ({
            ...g,
            reviewRequested: reviewMap.has(g.entry_id)
          }))
        );
      })
      .catch(() => {
        // Optionally set error or message here
      })
      .finally(() => {
        setReviewLoading(false);
      });
  };



  const fetchReviewResult = async (requestId) => {
  if (!token) return;
  setLoadingReviewResult(true);
  setReviewResultError(null);

  try {
    const res = await fetch(`http://localhost:8080/api/review_service/reviews/${requestId}/result`, {
      headers: {
        'Authorization': 'Bearer ' + token,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch review result');
    }

    const data = await res.json();
    setReviewResult(data);
  } catch (err) {
    setReviewResultError(err.message);
    setReviewResult(null);
  } finally {
    setLoadingReviewResult(false);
  }
};



  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-8">
        <Header />
        <div className="box-default max-w-5xl mx-auto mt-6 text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />
      <div className="box-default max-w-5xl mx-auto mt-6">
        <div className="box-header">
          <div className="text-primary">My Grades</div>
        </div>
        <table className="w-full mt-4 text-left border-collapse">
          <thead>
            <tr className="text-secondary border-b border-gray-400">
              <th className="p-2">Course</th>
              <th className="p-2">Year</th>
              <th className="p-2">Period</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grades.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-secondary">
                  No grades found.
                </td>
              </tr>
            )}
            {grades.map((g, idx) => (
              <React.Fragment key={g.course + g.period + idx}>
                <tr className="text-secondary border-b">
                  <td className="p-2">{courseNames[g.course_code]}</td>
                  <td className="p-2">{g.year}</td>
                  <td className="p-2">{g.exam_type}</td>
                  <td className="p-2"> {g.grade_status}</td>
                  <td className="p-2">
                    <button
                      className="btn text-button"
                      onClick={() =>
                        setSelectedGradeIdx(selectedGradeIdx === idx ? null : idx)
                      }
                    >
                      My Grade
                    </button>
                    <button
                      className={`btn text-button ml-2 ${ hasReviewForCourse(g.course_code) || (g.grade_status=='closed') ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        setReviewIdx(idx);
                        setReviewText('');
                        setReviewMessage('');
                      }}
                      disabled={hasReviewForCourse(g.course_code)||(g.grade_status=='closed')} // disable if review exists
                    >
                      {hasReviewForCourse(g.course_code) ? 'Request Submitted' : 'Request Review'}
                    </button>
                    <button
                        className={`btn text-button ml-2 ${!hasReviewForCourse(g.course_code) ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (showReviewForCourse === g.course_code) {
                            setShowReviewForCourse(null);
                          } else {
                            setShowReviewForCourse(g.course_code);
                            const review = reviews.find(r => r.course_code === g.course_code && r.student_code === studentCode);
                            if (review) {
                              fetchReviewResult(review.id);
                            } else {
                              setReviewResult(null);
                            }
                          }
                        }}
                        disabled={!hasReviewForCourse(g.course_code)}
                      >
                        My Request
                      </button>
                  </td>
                </tr>
                {selectedGradeIdx === idx && g.grade && (
                  <tr>
                    <td colSpan={4}>
                      <div className="box-default mt-2 p-4 text-secondary">
                        <div>
                          <strong><u>Total Grade:</u></strong> {g.grade.total}
                        </div>
                        {g.grade.questions && g.grade.questions.length > 0 && (
                          <div className="mt-2">
                            <strong>Questions:</strong>
                            <ul className="ml-4">
                              {g.grade.questions.map((q, i) => (
                                <li key={i}>
                                  {q.q}: {q.score}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {g.remarks && (
                          <div className="mt-2">
                            <strong>Remarks:</strong>
                            {(() => {
                              let parsed;
                              try {
                                parsed = typeof g.remarks === 'string' ? JSON.parse(g.remarks) : g.remarks;
                              } catch {
                                parsed = null;
                              }
                              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                return (
                                  <ul className="ml-4">
                                    {Object.entries(parsed).map(([key, value]) => (
                                      <li key={key}>
                                        <strong>{key}:</strong> {value}
                                      </li>
                                    ))}
                                  </ul>
                                );
                              }
                              // Αν δεν είναι JSON, δείξε το ως έχει
                              return <span className="ml-2">{g.remarks}</span>;
                            })()}
                          </div>
                        )}
                        </div>
                        {/* Φόρμα αναθεώρησης */}
                        {reviewIdx === idx && (
                          <div className="box-default mt-2 p-4 text-secondary">
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              setReviewMessage('');
                              setSubmittedStatus(prev => ({ ...prev, [g.entry_id]: true })); // mark as submitting
                              console.log("Token used for review fetch:", token);
                              console.log("Review request body:", {
                                entry_id: g.entry_id,
                                student_code: studentId,
                                reason: reviewText
                              });
                              try {
                                const res = await fetch('http://localhost:8080/api/review_service/reviews', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': 'Bearer ' + token,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    entry_id: g.entry_id,
                                    student_code: studentCode,
                                    course_code: g.course_code, // <-- ΜΟΝΟ αυτό!
                                    reason: reviewText
                                  })
                                });
                                const data = await res.json();
                                console.log("Review response:", data);
                                if (res.ok) {
                                  setReviewMessage('Review request submitted!');
                                  setReviewIdx(null);
                                } else {
                                  setReviewMessage(data.message || 'Failed to submit review request');
                                }
                              } catch {
                                setReviewMessage('Network error');
                              }
                            }}
                            className="mt-4"
                          >
                            <label className="text-secondary">Reason for review:</label>
                            <textarea
                              className="box-form w-full mt-2"
                              value={reviewText}
                              onChange={e => setReviewText(e.target.value)}
                              required
                              rows={2}
                            />
                            <button type="submit" className="btn-primary text-button mt-2">
                              Submit Review Request
                            </button>
                            {reviewMessage && <div className="text-secondary mt-2">{reviewMessage}</div>}
                          </form>
                          </div>
                        )}
                     
                    </td>
                  </tr>
                )}
                {showReviewForCourse === g.course_code && (
                  <tr>
                    <td colSpan={4} className="bg-gray-50 p-4 text-secondary">
                      <strong><u>My Request:</u></strong>
                      {loadingReviewResult && <div>Loading review result...</div>}
                      {reviewResultError && <div className="text-secondary">{reviewResultError}</div>}
                      {reviewResult && (
                        <div className="mt-2 text-secondary">
                          <div><li><strong>Status:</strong> {reviewResult.status}</li></div>
                          <div><li><strong>Reason:</strong> {reviewResult.reason}</li></div>
                          <div><li><strong>Requested At:</strong> {new Date(reviewResult.requested_at).toLocaleString()}</li></div>
                          {reviewResult.response ? (
                            <div className="mt-2 p-2 border rounded bg-white">
                              <div><u><strong>Response by Instructor:</strong></u></div>
                              <div><li><strong>Instructor ID:</strong> {reviewResult.response.instructor_id}</li></div>
                              <div><li><strong>New Grade Value:</strong> {reviewResult.response.new_grade_value}</li></div>
                              <div><li><strong>Comments:</strong> {reviewResult.response.comments}</li></div>
                              <div><li><strong>Responded At:</strong> {new Date(reviewResult.response.responded_at).toLocaleString()}</li></div>
                            </div>
                          ) : (
                            <div className="mt-2 italic text-gray-600"><u>Your review is still pending.</u></div>
                          )}
                        </div>
                      )}
                      {reviewResult && reviewResult.status === 'PENDING'&& (
                          <button
                            className="btn-primary text-button mt-4 bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                              if (!window.confirm("Are you sure you want to delete this review request?")) return;
                              try {
                                const res = await fetch(`http://localhost:8080/api/review_service/reviews/${reviewResult.request_id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': 'Bearer ' + token,
                                  },
                                });
                                if (res.status === 204) {
                                  alert("Review request deleted successfully.");
                                  setShowReviewForCourse(null);
                                  // Refresh review requests and grades to reflect deletion
                                  fetchReviewRequests();
                                } else {
                                  const data = await res.json();
                                  alert(data.message || "Failed to delete review request.");
                                }
                              } catch (error) {
                                alert("Network error deleting review request.");
                              }
                            }}
                          >
                            Delete Request
                          </button>
                        )}
                    </td>
                  </tr>
                )}



              </React.Fragment>
            ))}
          </tbody>
        </table>
        
      </div>
    </div>
  );
}
