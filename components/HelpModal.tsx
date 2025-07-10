
import React, { useState } from 'react';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left"
        aria-expanded={isOpen}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 pt-0 text-slate-300 space-y-2 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};


interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-amber-300">도움말 및 공략</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto">
            <AccordionItem title="시작 가이드">
                <p>칼라디아 연대기는 AI를 통해 진행되는 텍스트 기반 어드벤처 게임입니다. 당신은 칼라디아 대륙에서 모험을 시작하는 한 인물이 됩니다.</p>
                <p>게임을 시작할 때 선택하는 배경은 초기 자금, 명성, 병력, 장비에 영향을 미칩니다. 예를 들어, '상인'은 더 많은 골드를, '귀족'은 더 높은 명성을 가지고 시작합니다.</p>
            </AccordionItem>
            <AccordionItem title="게임 목표">
                <p>이 게임에는 정해진 최종 목표가 없습니다. 당신만의 이야기를 만들어나가세요.</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>강력한 군대를 이끌고 대륙을 정복하는 정복 군주</li>
                    <li>교역로를 장악하여 막대한 부를 쌓는 거상</li>
                    <li>한 세력에 충성하여 영지를 하사받는 충실한 기사</li>
                    <li>악명 높은 도적단을 이끄는 무법자</li>
                </ul>
                <p>당신의 선택이 칼라디아의 역사를 결정합니다.</p>
            </AccordionItem>
            <AccordionItem title="주요 활동">
                 <p><strong>전투:</strong> '전투' 버튼을 눌러 주변의 적과 싸울 수 있습니다. 전투 결과는 군대의 규모, 병사의 질, 플레이어와 동료의 능력치, 그리고 전술(Tactics) 스킬에 의해 결정됩니다.</p>
                <p><strong>퀘스트:</strong> 도시의 '성채'에서 영주를 만나 '일거리 문의'를 통해 퀘스트를 받을 수 있습니다. 퀘스트를 완료하면 골드와 명성, 그리고 해당 세력과의 관계도를 보상으로 얻습니다.</p>
                <p><strong>교역:</strong> 도시의 '시장'에서 상품을 사고 팔 수 있습니다. 도시마다 상품의 가격이 다르며, '소문'을 통해 비싸게 팔 수 있는 곳에 대한 힌트를 얻을 수 있습니다. '설득(Persuasion)' 스킬은 거래 가격에 영향을 줍니다.</p>
                <p><strong>모병 및 훈련:</strong> '선술집'에서 신병을 모집할 수 있습니다. '부대' 관리 화면에서 병사들을 더 강력한 유닛으로 훈련시킬 수 있으며, 이때 골드와 병사의 경험치가 필요합니다. '훈련교관(Trainer)' 스킬은 훈련 비용을 줄여주고 매일 병사들에게 추가 경험치를 제공합니다.</p>
                <p><strong>동료:</strong> 선술집에서 특별한 능력을 가진 동료를 영입할 수 있습니다. 동료는 강력한 전투원이자, 파티 전체에 적용되는 스킬(예: 의술, 전술 등)을 제공하는 중요한 자원입니다.</p>
            </AccordionItem>
            <AccordionItem title="핵심 능력치와 상태">
                 <p><strong>골드:</strong> 모든 활동의 기반이 되는 화폐입니다.</p>
                 <p><strong>명성:</strong> 명성이 높을수록 더 많은 병사를 이끌 수 있고, 영주들이 당신을 더 중요하게 생각합니다.</p>
                 <p><strong>레벨과 기술:</strong> 전투와 퀘스트로 경험치(XP)를 얻어 레벨을 올릴 수 있습니다. 레벨이 오르면 '기술 포인트'를 얻어 '캐릭터 정보' 창에서 새로운 기술을 배우거나 강화할 수 있습니다.</p>
                 <p><strong>부상과 회복:</strong> 전투에서 패배하거나 체력이 다하면 당신과 동료는 '부상' 상태가 됩니다. 부상 중에는 능력이 크게 저하됩니다. 매일 조금씩 자동으로 회복되지만, 선술집에서 '편안한 휴식'을 통해 골드를 지불하고 더 빨리 회복할 수도 있습니다. '의술(Wound Treatment)'과 '수술(Surgery)' 기술은 회복과 생존에 큰 도움이 됩니다.</p>
            </AccordionItem>
            <AccordionItem title="고급 공략">
                <p><strong>세력 관계:</strong> 당신의 행동은 다른 세력과의 관계에 영향을 미칩니다. 특정 세력의 퀘스트를 수행하면 관계가 좋아지고, 적대 세력을 공격하면 관계가 나빠집니다. 관계가 좋으면 해당 세력의 도시에서 병사를 더 싸게 모집할 수 있습니다.</p>
                <p><strong>사업장:</strong> 도시에서 '사업장'을 건설하면 매주 자동으로 수입을 얻을 수 있습니다. 안정적인 수입원을 확보하는 좋은 방법입니다.</p>
                <p><strong>영지:</strong> 한 세력에 가입하여 공을 세우면 군주에게 영지를 하사받을 수 있습니다. 영지에서는 세금을 징수하고, 주둔군을 관리하여 방어할 수 있습니다.</p>
                <p><strong>AI 위임:</strong> 'AI 위임' 모드를 켜면 AI가 자동으로 당신을 대신하여 게임을 진행합니다. 퀘스트 수락, 이동, 전투 등 대부분의 행동을 자동으로 수행하여 바쁠 때 유용합니다.</p>
            </AccordionItem>
             <div className="p-4 text-center text-slate-400">
                <p>칼라디아의 세계는 살아 움직입니다. 행운을 빕니다, 모험가여!</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
