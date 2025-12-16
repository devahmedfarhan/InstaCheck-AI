import React from 'react';
import { PageStatus, CheckStatus } from '../types';
import { cn } from '../utils/cn';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  checkStatus: CheckStatus;
  pageStatus: PageStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ checkStatus, pageStatus }) => {
  if (checkStatus === CheckStatus.PENDING || checkStatus === CheckStatus.IDLE) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Pending
      </span>
    );
  }

  if (checkStatus === CheckStatus.PROCESSING) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Checking
      </span>
    );
  }

  if (checkStatus === CheckStatus.FAILED) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Error
      </span>
    );
  }

  // Completed
  if (pageStatus === PageStatus.OPEN) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Page Open (Taken)
      </span>
    );
  }

  if (pageStatus === PageStatus.CLOSED) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
        <XCircle className="w-3 h-3 mr-1" />
        Not Found (Available)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      Unknown
    </span>
  );
};