import React from 'react';

interface ErrorModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ title, message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[101] p-4 animate-fade-in">
      <div className="bg-slate-800 border border-red-700 rounded-lg shadow-2xl w-full max-w-md animate-scale-up-fade-in">
        <div className="p-6">
          <h3 className="text-xl font-bold text-red-400 mb-4">{title}</h3>
          <p className="text-slate-300 mb-6 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="p-4 bg-slate-900/50 flex justify-end items-center space-x-4 rounded-b-lg">
          <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
