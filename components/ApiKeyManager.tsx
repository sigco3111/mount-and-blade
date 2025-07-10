import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeSlashIcon } from './icons/EyeSlashIcon';

type ApiKeyStatus = 'loading' | 'env' | 'local' | 'none' | 'invalid';

interface ApiKeyManagerProps {
  status: ApiKeyStatus;
  onSaveKey: (key: string) => Promise<void>;
  isLoading: boolean;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ status, onSaveKey, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const isEnvKey = status === 'env';
  const isActive = status === 'env' || status === 'local';

  useEffect(() => {
    // Automatically open the panel if no key is set or the key is invalid.
    if (status === 'none' || status === 'invalid') {
      setIsOpen(true);
    }
  }, [status]);

  const handleSave = () => {
    if (keyInput) {
      onSaveKey(keyInput);
    }
  };

  const getStatusInfo = (): { text: string; color: string; bgColor: string; } => {
      switch(status) {
          case 'env':
              return { text: '활성 (보안 설정됨)', color: 'text-green-400', bgColor: 'bg-green-400' };
          case 'local':
              return { text: '활성', color: 'text-green-400', bgColor: 'bg-green-400' };
          case 'invalid':
          case 'none':
              return { text: '비활성', color: 'text-red-400', bgColor: 'bg-red-500' };
          default: // loading
              return { text: '확인 중...', color: 'text-yellow-400', bgColor: 'bg-yellow-500' };
      }
  }
  
  const statusInfo = getStatusInfo();

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-sm bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl z-[102] transition-all duration-300 ease-in-out">
        <div 
          className="p-4 flex justify-between items-center cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
          role="button"
          aria-expanded={isOpen}
          aria-controls="api-key-panel"
        >
            <h3 className="text-lg font-semibold text-white flex items-center">
                <KeyIcon className="h-5 w-5 mr-3 text-amber-300" />
                Gemini API 키
            </h3>
            <div className="flex items-center">
              <span className={`text-sm ${statusInfo.color}`}>{statusInfo.text}</span>
              <span className={`ml-3 w-3 h-3 rounded-full ${statusInfo.bgColor} ${isLoading ? 'animate-pulse' : ''}`}></span>
            </div>
        </div>
        
        {isOpen && (
            <div id="api-key-panel" className="px-4 pb-4 animate-fade-in">
                <div className="border-t border-slate-700 pt-4">
                    {isEnvKey && (
                        <div className="bg-amber-900/50 border border-amber-700 text-amber-200 text-sm p-3 rounded-md mb-4">
                            환경 변수 키 사용 중. 애플리케이션에 API 키가 내장되어 있어 우선적으로 사용됩니다. 아래 입력란은 비활성화됩니다.
                        </div>
                    )}
                    
                    {status === 'invalid' && (
                         <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm p-3 rounded-md mb-4">
                            유효하지 않은 키입니다. 다시 확인해주세요.
                        </div>
                    )}

                    <p className="text-xs text-slate-500 mb-2">API 키는 브라우저의 로컬 스토리지에만 저장됩니다.</p>
                    
                    <div className="relative mb-4">
                        <input 
                            type={showKey ? 'text' : 'password'}
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder="API 키를 여기에 붙여넣으세요"
                            disabled={isEnvKey || isLoading}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md py-2 pl-3 pr-10 text-white placeholder-slate-500 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-700 disabled:text-slate-500"
                            aria-label="Gemini API Key Input"
                        />
                        <button onClick={() => setShowKey(!showKey)} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white" title={showKey ? "키 숨기기" : "키 보기"}>
                            {showKey ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isEnvKey || isLoading || !keyInput}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                확인 중...
                            </>
                        ) : '키 저장 및 확인'}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default ApiKeyManager;