import React, { useState } from 'react';
import Header from '../components/Header_Institution';
import '../components/boxStyles.css';
import '../components/textStyles.css';
import '../components/buttonStyles.css';

export default function CreditsForm() {
  const [credits, setCredits] = useState('');
  const [method, setMethod] = useState('card');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [purchase, setPurchase] = useState(null);
  const token = localStorage.getItem('token');
  const institutionId = JSON.parse(atob(token.split('.')[1])).institution_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setPurchase(null);
    if (!institutionId) {
      setError('You are not associated with an institution.');
      return;
    }
    try {
      const response = await fetch('http://localhost:8080/api/credit_service/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          credits_bought: Number(credits),
          method: method,
          institution_id: institutionId,
          amount_paid: Number(credits),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Credits purchase request submitted! Complete payment to activate credits.');
        setCredits('');
        setPurchase(data);
      } else {
        setError(data.message || 'Purchase failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <Header />

      <div className="box-default max-w-md mx-auto">
        <div className="box-header">
          <div className="text-primary">Buy Credits</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-secondary" htmlFor="credits">Number of credits</label>
            <input
              type="number"
              name="credits"
              id="credits"
              value={credits}
              onChange={e => setCredits(e.target.value)}
              required
              min={1}
              className="box-form"
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className="text-secondary" htmlFor="method">Payment Method</label>
            <select
              name="method"
              id="method"
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="box-form"
            >
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
          <button type="submit" className="btn-primary text-button">
            Purchase
          </button>
        </form>
        {purchase && (
          <div className="mt-4">
            <PurchaseActions purchase={purchase} />
          </div>
        )}
      </div>
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

function PurchaseActions({ purchase }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const token = localStorage.getItem('token');

  const handleCompletePayment = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `http://localhost:8080/api/credit_service/purchases/${purchase.id}/complete`,
        {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSuccess('Payment completed!');
        // Optionally refresh purchase info here
      } else {
        setError(data.message || 'Failed to complete payment');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {purchase.status !== 'COMPLETED' && (
        <button
          className="btn btn-success"
          style={{ backgroundColor: 'green', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', marginTop: 8 }}
          onClick={handleCompletePayment}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Complete Payment'}
        </button>
      )}
      {success && <div className="text-green-600 font-semibold">{success}</div>}
      {error && <div className="text-red-600 font-semibold">{error}</div>}
    </div>
  );
}
