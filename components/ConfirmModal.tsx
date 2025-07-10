import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel, confirmText = '확인', cancelText = '취소' }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[101] p-4 animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md animate-scale-up-fade-in">
        <div className="p-6">
          <h3 className="text-xl font-bold text-amber-300 mb-4">{title}</h3>
          <p className="text-slate-300 mb-6 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="p-4 bg-slate-900/50 flex justify-end items-center space-x-4 rounded-b-lg">
          <button onClick={onCancel} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded transition">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
