import React, { useState } from 'react';
import { BACKGROUND_OPTIONS } from '../constants';
import { CharacterBackground, CharacterBackgroundId } from '../types';

type ApiKeyStatus = 'loading' | 'env' | 'local' | 'none' | 'invalid';

interface StartScreenProps {
  onStartGame: (background: CharacterBackground) => void;
  isLoading: boolean;
  apiKeyStatus: ApiKeyStatus;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStartGame, isLoading, apiKeyStatus }) => {
  const [selectedBg, setSelectedBg] = useState<CharacterBackgroundId>(CharacterBackgroundId.NOMAD);

  const handleStart = () => {
    const background = BACKGROUND_OPTIONS.find(bg => bg.id === selectedBg);
    if (background) {
      onStartGame(background);
    }
  };

  const isApiKeyReady = apiKeyStatus === 'env' || apiKeyStatus === 'local';

  const getButtonText = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          캐릭터 생성 중...
        </div>
      );
    }
    if (!isApiKeyReady) {
      return 'API 키를 설정해주세요';
    }
    return '모험 시작';
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center p-4" style={{backgroundImage: "url('https://picsum.photos/seed/calradia/1920/1080')"}}>
      <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-slate-700 text-white">
        <h1 className="text-4xl font-bold text-amber-300 mb-2 text-center" style={{fontFamily: 'serif'}}>마운트 앤 블레이드 Web</h1>
        <p className="text-slate-300 mb-8 text-center">당신의 배경을 선택하고 모험을 시작하세요.</p>

        <div className="space-y-4 mb-8">
          {BACKGROUND_OPTIONS.map((bg) => (
            <label
              key={bg.id}
              className={`block p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                selectedBg === bg.id ? 'bg-amber-800/50 border-amber-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <input
                type="radio"
                name="background"
                value={bg.id}
                checked={selectedBg === bg.id}
                onChange={() => setSelectedBg(bg.id)}
                className="hidden"
              />
              <h3 className="text-lg font-semibold text-amber-100">{bg.name}</h3>
              <p className="text-sm text-slate-300">{bg.description}</p>
            </label>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={isLoading || !isApiKeyReady}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg text-xl transition-transform duration-200 ease-in-out transform hover:scale-105"
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default StartScreen;