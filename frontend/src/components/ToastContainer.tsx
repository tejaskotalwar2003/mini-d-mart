import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, XCircle, Info, X, ShoppingCart } from 'lucide-react';

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
};

const borderColors = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-3 sm:right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto flex items-start gap-3 bg-white shadow-2xl border border-gray-200
            border-l-4 ${borderColors[toast.type]} rounded-2xl px-4 py-3
            w-[calc(100vw-24px)] sm:w-80 max-w-sm
            animate-in slide-in-from-right-4 fade-in duration-300
          `}
          role="alert"
        >
          {/* Product thumbnail or type icon */}
          {toast.imageUrl ? (
            <img
              src={toast.imageUrl}
              alt="product"
              className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="mt-0.5">{icons[toast.type]}</div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
              {toast.message}
            </p>
            {toast.subMessage && (
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{toast.subMessage}</p>
            )}
            {toast.type === 'success' && (
              <div className="flex items-center gap-1 mt-1">
                <ShoppingCart className="w-3 h-3 text-emerald-600" />
                <span className="text-[11px] font-semibold text-emerald-600">Added to cart!</span>
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 -mt-0.5 -mr-1 p-1 rounded-lg hover:bg-gray-100"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
