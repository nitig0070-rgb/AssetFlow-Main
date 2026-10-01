import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ResourceBooking() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals / Forms state
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [bookingForm, setBookingForm] = useState({ asset_id: '', start_time: '', end_time: '' });
 
  const loadData = async () => {
    try {
      setLoading(true);
      const [assetsRes, bookingsRes] = await Promise.all([
        api.get('/assets?is_bookable=true'),
        api.get(selectedResourceId ? `/bookings?asset_id=${selectedResourceId}` : '/bookings')
      ]);
      setResources(assetsRes.assets || []);
      setBookings(bookingsRes.bookings || []);
    } catch (err) {
      setError(err.message || 'Failed to load bookings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedResourceId]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bookingForm.asset_id || !bookingForm.start_time || !bookingForm.end_time) {
      setError('Resource, start time, and end time are required.');
      return;
    }

    try {
      await api.post('/bookings', bookingForm);
      setSuccess('Booking created successfully!');
      setShowBookModal(false);
      setBookingForm({ asset_id: '', start_time: '', end_time: '' });
      loadData();
    } catch (err) {
      setError(err.message || err.data?.message || 'Failed to create booking due to scheduling conflicts.');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setError('');
    setSuccess('');
    try {
      await api.put(`/bookings/${bookingId}/cancel`, {});
      setSuccess('Booking cancelled successfully.');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking.');
    }
  };

  const openBookModal = (resourceId = '') => {
    setBookingForm({ asset_id: resourceId, start_time: '', end_time: '' });
    setShowBookModal(true);
  };

  return (
    <div>
      {/* Quick Booking trigger */}
      <div className="flex gap-3 mb-6 justify-start">
        <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => openBookModal('')}>
          + Reserve a Resource
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs font-bold text-left mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-xl p-3.5 text-xs font-bold text-left mb-6">
          {success}
        </div>
      )}

      {/* Grid view of shared resources */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left mb-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Shared Bookable Resources</h3>
          <div className="w-[220px]">
            <select
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
            >
              <option value="">All Shared Resources</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.asset_tag})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.length === 0 ? (
            <div className="text-slate-400 text-xs font-bold py-4">No shared bookable resources registered.</div>
          ) : (
            resources.map(resource => (
              <div key={resource.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition-all">
                <div className="flex justify-between items-start gap-4">
                  <div className="font-bold text-sm text-slate-900">{resource.name}</div>
                  <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                    resource.status === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-amber-50 text-amber-600 border-amber-200/50'
                  }`}>
                    {resource.status}
                  </span>
                </div>
                <div className="text-slate-400 text-[10px] font-bold mt-2">Tag: {resource.asset_tag} | Location: {resource.location || 'N/A'}</div>
                <button
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2 px-4 text-xs cursor-pointer transition-colors mt-4 text-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={['Retired', 'Disposed', 'Lost'].includes(resource.status)}
                  onClick={() => openBookModal(resource.id)}
                >
                  Book Slot
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section: Calendar / Reservation Schedule List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Active Reservation Schedule</h3>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm font-semibold py-4">Loading schedule...</div>
        ) : (
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Resource</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Reserved By</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Start Date/Time</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">End Date/Time</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Booking Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr><td colSpan="7" className="py-8 text-slate-400 text-xs font-bold text-center">No active bookings recorded in this scope.</td></tr>
                ) : (
                  bookings.map(book => {
                    const isOwner = book.user_id === user?.id;
                    const canCancel = (isOwner || ['AssetManager', 'Admin'].includes(user?.role)) && book.status !== 'Cancelled';
                    return (
                      <tr key={book.id}>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{book.asset_name}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{book.asset_tag}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">
                          {book.user_name} {isOwner && <span className="text-[9px] font-bold rounded bg-emerald-50 text-emerald-600 px-1 py-0.5 ml-1.5 uppercase">Me</span>}
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{new Date(book.start_time).toLocaleString()}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{new Date(book.end_time).toLocaleString()}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                            book.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200/50' :
                            book.status === 'Ongoing' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-blue-50 text-blue-600 border-blue-200/50'
                          }`}>
                            {book.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          {canCancel ? (
                            <button
                              className="border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors"
                              onClick={() => handleCancelBooking(book.id)}
                            >
                              Cancel Booking
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs font-bold">Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Reserve Shared Resource</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowBookModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleBookingSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Select Resource</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={bookingForm.asset_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, asset_id: e.target.value })}
                  >
                    <option value="">Choose Room/Vehicle/Equipment</option>
                    {resources.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.asset_tag} - {r.status})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={bookingForm.start_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                  />
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">End Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={bookingForm.end_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowBookModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Book Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}