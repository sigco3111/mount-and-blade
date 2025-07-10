import React, { useMemo } from 'react';
import { AILord, Location } from '../types';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';

interface WorldMapProps {
  locations: Record<string, Location>;
  currentLocationId: string;
  onTravel: (locationId: string) => void;
  isLoading: boolean;
  highlightedLocationId: string | null;
  aiLords: Record<string, AILord>;
}

const FACTION_COLORS: Record<string, string> = {
  swadia: 'text-amber-400',
  nords: 'text-blue-400',
  vaegirs: 'text-gray-300',
  khergits: 'text-green-400',
  sarranids: 'text-yellow-500',
  neutral: 'text-slate-500',
};

const WorldMap: React.FC<WorldMapProps> = ({ locations, currentLocationId, onTravel, isLoading, highlightedLocationId, aiLords }) => {
  const allLocations = Object.values(locations);
  const currentLocation = locations[currentLocationId];
  
  const lordPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; lords: AILord[] }> = {};
    Object.values(aiLords).forEach(lord => {
        if (!lord.isDefeated) {
            if (!positions[lord.currentLocationId]) {
                const loc = locations[lord.currentLocationId];
                if(loc) {
                    positions[lord.currentLocationId] = { x: loc.x, y: loc.y, lords: [] };
                }
            }
             if (positions[lord.currentLocationId]) {
                positions[lord.currentLocationId].lords.push(lord);
            }
        }
    });
    return positions;
  }, [aiLords, locations]);


  return (
    <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold text-sky-300 mb-4">월드맵</h3>
      <div className="relative aspect-[4/3] bg-gray-800/30 rounded-lg border border-slate-600 overflow-hidden" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/low-contrast-linen.png')"}}>
        <svg width="100%" height="100%" className="absolute inset-0">
          {/* Connection Lines */}
          {allLocations.map(loc =>
            loc.connectedTo.map(connId => {
              const connLoc = locations[connId];
              if (loc.id < connId) {
                return (
                  <line key={`${loc.id}-${connId}`}
                        x1={`${loc.x}%`} y1={`${loc.y}%`}
                        x2={`${connLoc.x}%`} y2={`${connLoc.y}%`}
                        stroke="rgba(100, 116, 139, 0.5)" strokeWidth="2" strokeDasharray="5, 5" />
                );
              }
              return null;
            })
          )}
        </svg>

        {/* Locations */}
        {allLocations.map(loc => {
          const isCurrent = loc.id === currentLocationId;
          const isConnected = currentLocation.connectedTo.includes(loc.id);
          const isClickable = isConnected && !isLoading;
          const isHighlighted = loc.id === highlightedLocationId;

          return (
            <div
              key={loc.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group ${isHighlighted ? 'z-10' : ''}`}
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              title={loc.name}
            >
              <button
                onClick={() => isClickable && onTravel(loc.id)}
                disabled={!isClickable}
                aria-label={isCurrent ? `${loc.name} (현재 위치)` : `Travel to ${loc.name}`}
                className={`
                  w-5 h-5 rounded-full border-2
                  transition-transform duration-200
                  flex items-center justify-center
                  ${isClickable ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}
                  ${isCurrent ? 'border-amber-300' : isConnected ? 'border-sky-300' : 'border-slate-500'}
                  ${isHighlighted ? 'animate-map-glow' : ''}
                `}
              >
                <div className={`
                  w-full h-full rounded-full transition-all duration-300
                  ${isCurrent ? 'bg-amber-400 animate-pulse' :
                    isConnected ? 'bg-sky-500' :
                    'bg-slate-600'
                  }
                  ${loc.ownerId === 'player' ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-800/70' : ''}
                `}></div>
              </button>
              <div className={`
                mt-2 px-2 py-0.5 rounded-full bg-slate-900/60
                text-xs font-bold whitespace-nowrap transition-colors duration-300 pointer-events-none
                ${isCurrent || isHighlighted || loc.ownerId === 'player' ? 'text-amber-300' :
                  isConnected ? 'text-sky-200' :
                  'text-slate-400'
                }
              `}>
                {loc.name}
              </div>
            </div>
          );
        })}
        
        {/* AI Lords */}
        {Object.entries(lordPositions).map(([locationId, posData]) =>
            posData.lords.map((lord, index) => (
                <div
                    key={lord.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out z-[5]"
                    style={{
                        left: `${posData.x + 2.5 + index * 1.5}%`,
                        top: `${posData.y - 2.5}%`,
                    }}
                    title={lord.name}
                >
                    <ShieldCheckIcon className={`w-4 h-4 ${FACTION_COLORS[lord.factionId] || 'text-gray-500'} drop-shadow-lg`} />
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default WorldMap;