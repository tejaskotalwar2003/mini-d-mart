import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { AuditLogResponse } from '../../types';
import {
  History,
  Filter,
  Copy,
  Check,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileCode,
} from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (actionFilter) params.action = actionFilter;
      if (entityTypeFilter) params.entity_type = entityTypeFilter;

      const res = await apiClient.get<AuditLogResponse[]>('/api/v1/admin/audit-logs', { params });
      setLogs(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, actionFilter, entityTypeFilter]);

  const handleCopyId = (idStr?: string | null) => {
    if (!idStr) return;
    navigator.clipboard.writeText(idStr);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('CREATED') || action.includes('APPROVED')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (action.includes('UPDATED') || action.includes('ADJUSTED') || action.includes('CHANGED')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (action.includes('REJECTED') || action.includes('DEACTIVATED') || action.includes('CANCELLED')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const actionOptions = [
    { label: 'All Actions', value: '' },
    { label: 'PRODUCT_CREATED', value: 'PRODUCT_CREATED' },
    { label: 'PRODUCT_UPDATED', value: 'PRODUCT_UPDATED' },
    { label: 'PRODUCT_DEACTIVATED', value: 'PRODUCT_DEACTIVATED' },
    { label: 'ORDER_STATUS_CHANGED', value: 'ORDER_STATUS_CHANGED' },
    { label: 'RETURN_APPROVED', value: 'RETURN_APPROVED' },
    { label: 'RETURN_REJECTED', value: 'RETURN_REJECTED' },
    { label: 'INVENTORY_ADJUSTED', value: 'INVENTORY_ADJUSTED' },
  ];

  const entityTypeOptions = [
    { label: 'All Entity Types', value: '' },
    { label: 'Product', value: 'Product' },
    { label: 'Order', value: 'Order' },
    { label: 'ReturnRequest', value: 'ReturnRequest' },
    { label: 'Inventory', value: 'Inventory' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <History className="w-7 h-7 text-blue-600" />
            System Audit Logs
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Immutable audit record tracing system actions, actor emails, and JSON metadata diffs
          </p>
        </div>
        <Link
          to="/admin/dashboard"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <Filter className="w-4 h-4 text-blue-600" />
          Filter Logs:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white font-semibold"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white font-semibold"
          >
            {entityTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-2" />
          Loading audit logs...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchAuditLogs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
          <History className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Audit Logs Found</h3>
          <p className="text-xs text-gray-500">No audit log entries match the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor Email</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity Type</th>
                  <th className="p-4">Entity ID</th>
                  <th className="p-4 text-right">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-gray-500 font-medium whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      {log.user_email || <span className="italic text-gray-400">System</span>}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-700">{log.entity_type}</td>
                    <td className="p-4 font-mono text-gray-500">
                      {log.entity_id ? (
                        <div className="flex items-center gap-1">
                          <span title={log.entity_id}>
                            {log.entity_id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => handleCopyId(log.entity_id)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                            title="Copy full UUID"
                          >
                            {copiedId === log.entity_id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-100 text-xs">
            <p className="text-gray-600">
              Showing page <span className="font-bold text-gray-900">{page}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 inline" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < pageSize}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                Audit Metadata Details
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Action: <span className="font-bold text-gray-900">{selectedLog.action}</span> • Actor:{' '}
                <span className="font-bold text-gray-900">{selectedLog.user_email || 'System'}</span>
              </p>
            </div>

            <div className="bg-gray-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 shadow-inner">
              <pre>{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
