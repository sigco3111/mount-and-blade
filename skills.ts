import { Skill } from './types';

export const SKILLS: Record<string, Skill> = {
  leadership: {
    id: 'leadership',
    name: '통솔력',
    description: (level: number) => `부대의 사기를 높여 전투 효율을 증가시키고, 부대 최대 규모가 ${level * 5}만큼 증가합니다. (현재: +${level * 5})`,
    maxLevel: 10,
  },
  tactics: {
    id: 'tactics',
    name: '전술',
    description: (level: number) => `전투 시뮬레이션에서 이점을 얻습니다. 레벨이 높을수록 아군의 손실을 줄이고 승리할 확률이 높아집니다.`,
    maxLevel: 5,
  },
  persuasion: {
    id: 'persuasion',
    name: '설득',
    description: (level: number) => `퀘스트 보상과 거래 가격이 ${level * 4}%만큼 유리해집니다. (현재: ${level * 4}%)`,
    maxLevel: 5,
  },
  trainer: {
    id: 'trainer',
    name: '훈련교관',
    description: (level: number) => `매일 부대의 모든 병사가 ${level * 2}의 경험치를 얻고, 훈련 비용이 ${level * 5}%만큼 감소합니다. (현재: ${level * 5}% 할인)`,
    maxLevel: 5,
  },
  wound_treatment: {
    id: 'wound_treatment',
    name: '의술',
    description: (level: number) => `부상당한 영웅(플레이어와 동료)들이 매일 ${10 + level * 5}의 체력을 추가로 회복합니다.`,
    maxLevel: 5,
  },
  surgery: {
    id: 'surgery',
    name: '수술',
    description: (level: number) => `전투 후, 사망하는 병사 중 일부를 부상병으로 전환시켜 살릴 확률이 증가합니다. 이 기술은 파티 내에서 가장 높은 레벨이 적용됩니다.`,
    maxLevel: 5,
  },
};