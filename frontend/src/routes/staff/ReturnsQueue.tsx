import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { ReturnRequestResponse } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const ReturnsQueue: React.FC = () => {
  const [returns, setReturns] = useState<ReturnRequestResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Action Modal State
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequestResponse | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchReturns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/v1/staff/returns?status=${statusFilter}`
        : '/api/v1/staff/returns';
      const res = await apiClient.get<ReturnRequestResponse[]>(url);
      setReturns(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load return requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const handleOpenActionModal = (
    retReq: ReturnRequestResponse,
    type: 'APPROVE' | 'REJECT'
  ) => {
    setSelectedReturn(retReq);
    setActionType(type);
    setResolutionNote('');
    setModalError(null);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn || !actionType) return;

    setIsSubmitting(true);
    setModalError(null);

    const endpoint =
      actionType === 'APPROVE'
        ? `/api/v1/staff/returns/${selectedReturn.id}/approve`
        : `/api/v1/staff/returns/${selectedReturn.id}/reject`;

    try {
      await apiClient.patch<ReturnRequestResponse>(endpoint, {
        resolution_note: resolutionNote.trim() || undefined,
      });

      setSelectedReturn(null);
      setActionType(null);
      await fetchReturns();
    } catch (err: any) {
      // Handle 409 conflict (e.g. replacement item out of stock or already resolved)
      if (err.response?.status === 409) {
        setModalError(
          err.response?.data?.detail ||
            'Conflict! The request could not be processed (e.g., replacement item is out of stock or request was already updated).'
        );
      } else {
        setModalError(err.response?.data?.detail || 'Failed to resolve return request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusTabOptions = [
    { label: 'All Requests', value: '' },
    { label: 'Requested (Pending)', value: 'REQUESTED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-purple-600" />
            Returns & Exchanges Queue
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review customer return and exchange requests and restore inventory stock
          </p>
        </div>
        <Link
          to="/staff/dashboard"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100 no-scrollbar">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
        {statusTabOptions.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-purple-600 mb-2" />
          Loading return requests...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchReturns}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
          <RotateCcw className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Return Requests</h3>
          <p className="text-xs text-gray-500">No return or exchange requests match the selected status filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Requested Date</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Qty</th>
                  <th className="p-4 max-w-xs">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-gray-500 font-medium whitespace-nowrap">
                      {new Date(ret.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-4 font-extrabold text-gray-900">
                      {ret.product_name}
                      {ret.exchange_for_product_name && (
                        <span className="block text-[10px] text-purple-600 font-semibold mt-0.5">
                          Exchanging for: {ret.exchange_for_product_name}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {ret.type === 'EXCHANGE' ? (
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 w-fit">
                          <RefreshCw className="w-3 h-3" />
                          EXCHANGE
                        </span>
                      ) : (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 w-fit">
                          <RotateCcw className="w-3 h-3" />
                          RETURN
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-gray-800">{ret.requested_qty}</td>
                    <td className="p-4 max-w-xs text-gray-600 italic truncate" title={ret.reason}>
                      "{ret.reason}"
                    </td>
                    <td className="p-4">
                      <StatusBadge status={ret.status} />
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      {ret.status === 'REQUESTED' ? (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(ret, 'APPROVE')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(ret, 'REJECT')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">
                          Resolved by {ret.resolved_by_name || 'Staff'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Modal */}
      {selectedReturn && actionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl relative">
            <button
              onClick={() => {
                setSelectedReturn(null);
                setActionType(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {actionType === 'APPROVE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {actionType === 'APPROVE' ? 'Approve Return Request' : 'Reject Return Request'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Item: <span className="font-bold text-gray-900">{selectedReturn.product_name}</span>{' '}
                ({selectedReturn.type})
              </p>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Resolution Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder={
                    actionType === 'APPROVE'
                      ? 'e.g. Verified item defect and restored stock.'
                      : 'e.g. Item returned outside allowable policy parameters.'
                  }
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReturn(null);
                    setActionType(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 ${
                    actionType === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : actionType === 'APPROVE' ? (
                    'Confirm Approval'
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsQueue;
