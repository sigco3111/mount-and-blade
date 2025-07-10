import React from 'react';
import { GameEvent, GameEventChoice } from '../types';

interface TravelEventModalProps {
  event: GameEvent;
  onResolve: (choice: GameEventChoice) => void;
  isResolving: boolean;
}

const TravelEventModal: React.FC<TravelEventModalProps> = ({ event, onResolve, isResolving }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-up-fade-in overflow-hidden">
        
        <div className="p-6 overflow-y-auto space-y-4 flex-grow">
          <h3 className="text-2xl font-bold text-amber-300" style={{fontFamily: 'serif'}}>{event.title}</h3>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{event.narrative}</p>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex-shrink-0">
          {isResolving ? (
            <div className="flex items-center justify-center text-amber-300 h-12">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              처리 중...
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              {event.choices.map((choice, index) => (
                <button 
                  key={index}
                  onClick={() => onResolve(choice)}
                  className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105"
                >
                  {choice.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelEventModal;