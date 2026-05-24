import React from 'react';
import { StateId } from '../types';
import { STATE_NAMES } from '../services/australiaHolidayService';

interface AUMapProps {
  highlightedStates: StateId[];
  focusedStates: StateId[];
}

// Simplified schematic SVG paths. ViewBox "0 0 500 470".
// Scale approximations: ~12px per degree longitude (112–154°E),
//                       ~12px per degree latitude  (9–44°S, y increases southward).
const STATES: Record<StateId, { path: string; labelPos: [number, number]; fontSize: number }> = {
  [StateId.WA]: {
    path: "M 5 62 L 190 62 L 190 406 L 125 450 L 5 426 Z",
    labelPos: [94, 237], fontSize: 11,
  },
  [StateId.NT]: {
    path: "M 190 44 L 302 44 L 302 212 L 190 212 Z",
    labelPos: [246, 128], fontSize: 10,
  },
  [StateId.SA]: {
    path: "M 190 212 L 302 212 L 354 258 L 354 406 L 190 406 Z",
    labelPos: [268, 310], fontSize: 10,
  },
  [StateId.QLD]: {
    path: "M 302 0 L 500 0 L 500 258 L 354 258 L 302 212 Z",
    labelPos: [410, 130], fontSize: 11,
  },
  [StateId.NSW]: {
    path: "M 354 258 L 500 258 L 500 388 L 444 428 L 354 388 Z",
    labelPos: [438, 322], fontSize: 10,
  },
  [StateId.VIC]: {
    path: "M 354 388 L 444 428 L 500 388 L 500 450 L 354 450 Z",
    labelPos: [435, 420], fontSize: 9,
  },
  [StateId.TAS]: {
    path: "M 375 460 L 498 460 L 492 490 L 379 490 Z",
    labelPos: [436, 475], fontSize: 8,
  },
  [StateId.ACT]: {
    path: "M 453 346 L 482 346 L 482 380 L 453 380 Z",
    labelPos: [467, 363], fontSize: 6,
  },
};

const AUMap: React.FC<AUMapProps> = ({ highlightedStates, focusedStates }) => {
  return (
    <div className="relative w-full min-h-[460px] bg-slate-50 rounded-xl overflow-hidden flex flex-col items-center justify-center border border-slate-200 shadow-inner">
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full drop-shadow-md"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      >
        <defs>
          <filter id="au-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform="translate(0, 5)">
          {/* State paths */}
          {(Object.entries(STATES) as [StateId, typeof STATES[StateId]][]).map(([id, { path }]) => {
            const isFocused     = focusedStates.includes(id);
            const isHighlighted = highlightedStates.includes(id);

            let fill    = 'fill-slate-200';
            let stroke  = 'stroke-white';
            let opacity = 'opacity-100';

            if (focusedStates.length > 0) {
              if (isFocused) {
                fill   = 'fill-amber-500';
                stroke = 'stroke-amber-600';
              } else {
                fill    = 'fill-slate-200';
                opacity = 'opacity-40';
              }
            } else if (isHighlighted) {
              fill   = 'fill-amber-300';
              stroke = 'stroke-amber-400';
            } else {
              fill   = 'fill-slate-200';
              stroke = 'stroke-slate-100';
            }

            return (
              <path
                key={id}
                d={path}
                className={`transition-all duration-500 ease-in-out stroke-[1.5px] ${fill} ${stroke} ${opacity} hover:brightness-95`}
              >
                <title>{STATE_NAMES[id]}</title>
              </path>
            );
          })}

          {/* Labels */}
          {(Object.entries(STATES) as [StateId, typeof STATES[StateId]][]).map(([id, { labelPos, fontSize }]) => {
            const isFocused     = focusedStates.includes(id);
            const isHighlighted = highlightedStates.includes(id);
            const showLabel     = isFocused || focusedStates.length === 0;
            if (!showLabel) return null;

            const textColor = isFocused
              ? 'fill-white font-bold'
              : isHighlighted
              ? 'fill-amber-900 font-semibold'
              : 'fill-slate-400 font-medium';

            return (
              <text
                key={`lbl-${id}`}
                x={labelPos[0]}
                y={labelPos[1]}
                className={`pointer-events-none select-none transition-all duration-300 ${textColor}`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                style={{ textShadow: '0px 1px 2px rgba(255,255,255,0.8)' }}
              >
                {id.toUpperCase()}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Map legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-sm border border-slate-100 text-xs text-slate-600">
        <div className="font-semibold mb-2 text-slate-800">Map Key</div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-3 h-3 bg-amber-500 rounded border border-amber-600 shadow-sm" /> Selected State
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-3 h-3 bg-amber-300 rounded border border-amber-400 shadow-sm" /> Has Holiday This Month
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-slate-200 rounded border border-slate-300 shadow-sm" /> No State Holiday
        </div>
      </div>
    </div>
  );
};

export default AUMap;
