import React from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
  icon,
}) => {
  if (!isOpen) return null;

  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md hover:bg-slate-800 dark:hover:bg-slate-100',
  };

  const iconContainerClasses = {
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    primary: 'bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-slate-300',
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {icon && (
              <div className={`p-3 rounded-full ${iconContainerClasses[confirmVariant]}`}>
                {icon}
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {message}
          </p>

          <div className="flex gap-3 justify-end">
            <Button
              onClick={onClose}
              disabled={isLoading}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              isLoading={isLoading}
              variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
              size="sm"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
