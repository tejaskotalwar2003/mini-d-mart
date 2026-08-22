import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import type { Category, Product, ProductListResponse } from '../../types';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  XCircle,
  AlertCircle,
  Loader2,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const pageSize = 10;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Product Modal State (Add / Edit)
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSku, setFormSku] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('kg');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formIsReturnable, setFormIsReturnable] = useState<boolean>(true);
  const [formQuantity, setFormQuantity] = useState<string>('50');
  const [formTaxRate, setFormTaxRate] = useState<string>('5');

  const [isSubmittingProduct, setIsSubmittingProduct] = useState<boolean>(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>('');
  const [catSlug, setCatSlug] = useState<string>('');
  const [catParentId, setCatParentId] = useState<string>('');
  const [isSubmittingCat, setIsSubmittingCat] = useState<boolean>(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // Deactivation Modal State
  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);
  const [isDeactivating, setIsDeactivating] = useState<boolean>(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await apiClient.get<Category[]>('/api/v1/categories');
      setCategories(res.data);
      if (res.data.length > 0 && !formCategoryId) {
        setFormCategoryId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch Admin Products
  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await apiClient.get<ProductListResponse>('/api/v1/admin/products', { params });
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load product catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, debouncedSearch]);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setFormName('');
    setFormDescription('');
    setFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCategoryId(categories[0]?.id || '');
    setFormPrice('100.00');
    setFormUnit('kg');
    setFormImageUrl('');
    setFormIsReturnable(true);
    setFormQuantity('50');
    setFormTaxRate('5');
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormDescription(prod.description || '');
    setFormSku(prod.sku);
    setFormCategoryId(prod.category_id);
    setFormPrice(String(prod.price));
    setFormUnit(prod.unit);
    setFormImageUrl(prod.image_url || '');
    setFormIsReturnable(prod.is_returnable);
    setFormQuantity(String(prod.quantity_available ?? 0));
    setFormTaxRate(String(prod.tax_rate ?? 5));
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);

    if (!formName.trim()) {
      setProductFormError('Product name is required.');
      return;
    }
    if (!formSku.trim()) {
      setProductFormError('SKU is required.');
      return;
    }
    const numPrice = Number(formPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      setProductFormError('Price must be greater than 0.');
      return;
    }

    setIsSubmittingProduct(true);
    try {
      const payload = {
        category_id: formCategoryId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        sku: formSku.trim(),
        price: numPrice,
        unit: formUnit.trim(),
        image_url: formImageUrl.trim() || undefined,
        is_returnable: formIsReturnable,
        quantity: isNaN(parseInt(formQuantity, 10)) ? 0 : Math.max(0, parseInt(formQuantity, 10)),
        tax_rate: isNaN(parseFloat(formTaxRate)) ? 5 : Math.max(0, parseFloat(formTaxRate)),
      };

      if (editingProduct) {
        await apiClient.patch(`/api/v1/products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post('/api/v1/products', payload);
      }

      setShowProductModal(false);
      await fetchProducts();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setProductFormError(`Conflict: Product SKU '${formSku}' is already registered.`);
      } else {
        setProductFormError(err.response?.data?.detail || 'Failed to save product.');
      }
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingProduct) return;
    setIsDeactivating(true);
    try {
      await apiClient.delete(`/api/v1/products/${deactivatingProduct.id}`);
      setDeactivatingProduct(null);
      await fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to deactivate product.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleCatNameChange = (val: string) => {
    setCatName(val);
    // Auto-generate slug convenience
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setCatSlug(slug);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatFormError(null);

    if (!catName.trim() || !catSlug.trim()) {
      setCatFormError('Category name and slug are required.');
      return;
    }

    setIsSubmittingCat(true);
    try {
      await apiClient.post('/api/v1/categories', {
        name: catName.trim(),
        slug: catSlug.trim(),
        parent_id: catParentId || undefined,
      });

      setCatName('');
      setCatSlug('');
      setCatParentId('');
      await fetchCategories();
    } catch (err: any) {
      setCatFormError(err.response?.data?.detail || 'Failed to add category.');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-emerald-600" />
            Product & Category Setup
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage product catalog, SKUs, pricing, returnability, and categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-gray-300"
          >
            <FolderPlus className="w-4 h-4 text-gray-600" />
            Categories ({categories.length})
          </button>
          <button
            onClick={handleOpenAddProduct}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name or SKU..."
          className="w-full text-sm focus:outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600 mb-2" />
          Loading products...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Products Found</h3>
          <p className="text-xs text-gray-500">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Tax Slab</th>
                  <th className="p-4">Returnable</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((prod) => (
                  <tr
                    key={prod.id}
                    className={`transition-colors ${
                      !prod.is_active ? 'bg-gray-100/70 text-gray-400' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                      <span className={!prod.is_active ? 'line-through text-gray-400' : ''}>
                        {prod.name}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-500">{prod.sku}</td>
                    <td className="p-4 font-medium text-gray-700">{prod.category_name}</td>
                    <td className="p-4 font-extrabold text-gray-900">
                      ₹{Number(prod.price).toFixed(2)}
                    </td>
                    <td className="p-4 text-gray-600">{prod.unit}</td>
                    <td className="p-4 font-extrabold">
                      <span
                        className={
                          prod.quantity_available === 0
                            ? 'text-red-600 font-bold'
                            : prod.quantity_available < 10
                            ? 'text-amber-600 font-bold'
                            : 'text-emerald-700 font-bold'
                        }
                      >
                        {prod.quantity_available}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-emerald-50 text-emerald-800 text-[11px] font-extrabold px-2 py-0.5 rounded border border-emerald-200">
                        {prod.tax_rate ?? 5}% GST
                      </span>
                    </td>
                    <td className="p-4">
                      {prod.is_returnable ? (
                        <span className="text-emerald-700 font-bold">Yes (7-day)</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="p-4">
                      {prod.is_active ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="bg-gray-200 text-gray-600 text-[10px] font-extrabold px-2 py-0.5 rounded border border-gray-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      {prod.is_active && (
                        <button
                          onClick={() => setDeactivatingProduct(prod)}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-100 text-xs">
            <p className="text-gray-600">
              Page <span className="font-bold text-gray-900">{page}</span> of{' '}
              <span className="font-bold text-gray-900">{totalPages}</span>
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-emerald-600" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>

            {productFormError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{productFormError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Organic Red Apples (1 kg)"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="PROD-APPLE-01"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="199.00"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Unit (e.g. kg, pack, L) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="kg"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Available Quantity (Stock) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="50"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Tax Slab (GST) *
                  </label>
                  <select
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold bg-white"
                  >
                    <option value="0">0% (Nil / Exempted)</option>
                    <option value="5">5% (Essential Groceries)</option>
                    <option value="12">12% (Processed Goods)</option>
                    <option value="18">18% (Standard Rate)</option>
                    <option value="28">28% (Luxury / Aerated)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Fresh farm apples..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsReturnable"
                  checked={formIsReturnable}
                  onChange={(e) => setFormIsReturnable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="formIsReturnable" className="font-semibold text-gray-800">
                  Eligible for 7-day Returns / Exchanges
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  disabled={isSubmittingProduct}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingProduct ? (
                    'Save Changes'
                  ) : (
                    'Create Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Deactivate Product?</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to deactivate{' '}
              <span className="font-bold text-gray-900">{deactivatingProduct.name}</span>? This will perform a soft-delete (`is_active=False`) to preserve historical order integrity.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeactivatingProduct(null)}
                disabled={isDeactivating}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {isDeactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowCategoryModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-emerald-600" />
              Manage Categories
            </h3>

            {/* Existing Categories List */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs"
                >
                  <span className="font-bold text-gray-900">{c.name}</span>
                  <span className="text-gray-400 font-mono">/{c.slug}</span>
                </div>
              ))}
            </div>

            {/* Add Category Form */}
            {catFormError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{catFormError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCategory} className="space-y-3 pt-2 border-t border-gray-100 text-xs">
              <h4 className="font-bold text-gray-800 uppercase tracking-wider">Add New Category</h4>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => handleCatNameChange(e.target.value)}
                  placeholder="e.g. Organic Beverages"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="organic-beverages"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingCat}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSubmittingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Category'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
