import React from 'react';
import type { OrderStatus, ReturnStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus | ReturnStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'PENDING':
      case 'REQUESTED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CONFIRMED':
      case 'PREPARING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'READY_FOR_PICKUP':
      case 'OUT_FOR_DELIVERY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'COMPLETED':
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'APPROVED':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'RETURN_REQUESTED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RETURN_APPROVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RETURN_REJECTED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formattedStatus = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shadow-2xs tracking-wider ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {formattedStatus}
    </span>
  );
};

export default StatusBadge;
