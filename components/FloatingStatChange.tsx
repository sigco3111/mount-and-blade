import React from 'react';

interface FloatingStatChangeProps {
  change: number;
}

const FloatingStatChange: React.FC<FloatingStatChangeProps> = ({ change }) => {
  if (change === 0) {
    return null;
  }

  const isPositive = change > 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-500';

  return (
    <div className={`absolute -top-5 right-0 pointer-events-none animate-float-up text-lg font-bold ${colorClass} [text-shadow:0_0_5px_rgba(0,0,0,0.5)]`}>
      {isPositive ? `+${change}` : change}
    </div>
  );
};

export default FloatingStatChange;