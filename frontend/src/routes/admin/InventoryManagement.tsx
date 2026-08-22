import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { InventoryOverviewResponse, LowStockItemResponse } from '../../types';
import {
  Store,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
} from 'lucide-react';

export const InventoryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'LOW_STOCK'>('ALL');

  const [inventoryList, setInventoryList] = useState<InventoryOverviewResponse[]>([]);
  const [lowStockList, setLowStockList] = useState<LowStockItemResponse[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stock Adjustment Modal State
  const [selectedInventory, setSelectedInventory] = useState<InventoryOverviewResponse | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allRes, lowRes] = await Promise.all([
        apiClient.get<InventoryOverviewResponse[]>('/api/v1/admin/inventory'),
        apiClient.get<LowStockItemResponse[]>('/api/v1/admin/inventory/low-stock'),
      ]);

      setInventoryList(allRes.data);
      setLowStockList(lowRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load store inventory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleOpenAdjustModal = (item: InventoryOverviewResponse) => {
    setSelectedInventory(item);
    setNewQuantity(item.quantity_available);
    setAdjustReason('');
    setModalError(null);
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory) return;

    if (!adjustReason.trim()) {
      setModalError('Reason for stock adjustment is required.');
      return;
    }
    if (newQuantity < 0) {
      setModalError('Quantity cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiClient.patch(`/api/v1/admin/inventory/${selectedInventory.id}/adjust`, {
        new_quantity_available: newQuantity,
        reason: adjustReason.trim(),
      });

      setSelectedInventory(null);
      await fetchInventory();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to adjust inventory stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Store className="w-7 h-7 text-amber-600" />
            Inventory & Low-Stock Alerts
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Store-level inventory overview, available/reserved stock, and manual stock adjustments
          </p>
        </div>
        <Link
          to="/admin/dashboard"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ALL'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Store className="w-4 h-4" />
          All Inventory ({inventoryList.length})
        </button>

        <button
          onClick={() => setActiveTab('LOW_STOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'LOW_STOCK'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Low Stock Alerts ({lowStockList.length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-600 mb-2" />
          Loading inventory stock...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchInventory}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeTab === 'ALL' ? (
        /* All Inventory Table */
        inventoryList.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
            No inventory records available.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Store Name</th>
                    <th className="p-4">Available Stock</th>
                    <th className="p-4">Reserved</th>
                    <th className="p-4">Reorder Threshold</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryList.map((item) => {
                    const isLowStock = item.quantity_available <= item.reorder_threshold;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50/80 transition-colors ${
                          isLowStock ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="p-4 font-extrabold text-gray-900">{item.product_name}</td>
                        <td className="p-4 text-gray-600 font-medium">{item.store_name}</td>
                        <td className="p-4">
                          <span
                            className={`font-black text-sm ${
                              isLowStock ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {item.quantity_available}
                          </span>
                          {isLowStock && (
                            <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                              Low Stock
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500 font-medium">{item.quantity_reserved}</td>
                        <td className="p-4 text-gray-500 font-medium">{item.reorder_threshold}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenAdjustModal(item)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Low Stock Alerts View */
        lowStockList.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-12 text-center text-emerald-900 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-bold">All Stock Levels Healthy!</h3>
            <p className="text-xs text-emerald-700">No products are currently below their reorder threshold.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockList.map((item) => (
              <div
                key={item.product_id}
                className="bg-white rounded-xl border-l-4 border-l-red-500 border-gray-200 border shadow-sm p-5 space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h3 className="font-extrabold text-gray-900 text-sm">{item.product_name}</h3>
                    <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-200 uppercase">
                      Low Stock
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 font-mono">SKU: {item.sku}</p>

                  <div className="pt-2 flex justify-between text-xs font-medium text-gray-700 border-t border-gray-100">
                    <span>
                      Store: <strong className="text-gray-900">{item.store_name}</strong>
                    </span>
                    <span>
                      Available:{' '}
                      <strong className="text-red-600 text-sm">{item.quantity_available}</strong> (Threshold:{' '}
                      {item.reorder_threshold})
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const fullItem = inventoryList.find((i) => i.product_id === item.product_id);
                    if (fullItem) handleOpenAdjustModal(fullItem);
                  }}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Quick Stock Adjustment
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Stock Adjustment Modal */}
      {selectedInventory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl relative">
            <button
              onClick={() => setSelectedInventory(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Adjust Stock Quantity
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Product: <span className="font-bold text-gray-900">{selectedInventory.product_name}</span> ({selectedInventory.store_name})
              </p>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Current Available Stock:</span>
                <span className="font-extrabold text-base text-gray-900">
                  {selectedInventory.quantity_available}
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Quantity Available *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Number(e.target.value))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Reason for Adjustment *
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Stock audit correction, damaged shipment intake, supplier restock..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInventory(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save Stock Correction'
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

export default InventoryManagement;
