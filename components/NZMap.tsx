import React from 'react';
import { RegionId } from '../types';

interface NZMapProps {
  highlightedRegions: RegionId[]; // Regions to show as 'active' (e.g. have a holiday)
  focusedRegions: RegionId[];     // Regions to spotlight (e.g. specific selected holiday)
}

const NZMap: React.FC<NZMapProps> = ({ highlightedRegions, focusedRegions }) => {
  // SVG ViewBox: 0 0 500 700
  // Detailed paths for NZ Regions
  const regions: Record<RegionId, { path: string; name: string; labelPos: [number, number] }> = {
    [RegionId.Northland]: {
      name: "Northland",
      path: "M245 40 C250 30, 260 10, 265 5 C275 15, 290 30, 295 45 C300 60, 285 75, 280 85 C270 85, 260 80, 250 80 C240 70, 235 60, 245 40 Z",
      labelPos: [265, 50]
    },
    [RegionId.Auckland]: {
      name: "Auckland",
      path: "M280 85 C285 90, 290 95, 285 105 C295 105, 300 110, 290 115 C280 112, 275 105, 270 105 C265 100, 270 95, 280 85 Z",
      labelPos: [295, 100] // Push label out slightly
    },
    [RegionId.Waikato]: {
      name: "Waikato",
      path: "M270 105 C275 110, 290 115, 295 120 C290 140, 280 150, 260 145 C250 140, 255 130, 255 125 C260 120, 265 115, 270 105 Z",
      labelPos: [265, 130]
    },
    [RegionId.BayOfPlenty]: {
      name: "Bay of Plenty",
      path: "M295 120 C310 120, 320 125, 330 135 C320 145, 310 150, 300 150 C290 140, 290 130, 295 120 Z",
      labelPos: [315, 135]
    },
    [RegionId.Gisborne]: {
      name: "Gisborne",
      path: "M330 135 C340 130, 355 135, 360 145 C350 160, 330 155, 325 150 C325 145, 330 135, 330 135 Z",
      labelPos: [345, 145]
    },
    [RegionId.Taranaki]: {
      name: "Taranaki",
      path: "M240 140 C250 140, 255 150, 255 160 C245 170, 230 165, 225 160 C225 150, 230 145, 240 140 Z",
      labelPos: [215, 155]
    },
    [RegionId.ManawatuWhanganui]: {
      name: "Manawatu-Whanganui",
      path: "M255 145 C270 150, 280 155, 280 180 C260 190, 250 185, 245 195 C235 185, 245 165, 255 145 Z",
      labelPos: [260, 170]
    },
    [RegionId.HawkesBay]: {
      name: "Hawke's Bay",
      path: "M300 150 C310 155, 325 150, 325 150 C320 180, 300 200, 280 205 C280 180, 290 160, 300 150 Z",
      labelPos: [305, 175]
    },
    [RegionId.Wellington]: {
      name: "Wellington",
      path: "M245 195 C255 190, 270 200, 270 215 C260 235, 245 230, 240 220 C240 210, 240 200, 245 195 Z",
      labelPos: [240, 215] // Left side
    },
    // South Island
    [RegionId.Tasman]: {
      name: "Tasman",
      path: "M210 240 C220 235, 230 240, 235 255 C230 270, 220 275, 210 270 C205 260, 205 250, 210 240 Z",
      labelPos: [205, 255]
    },
    [RegionId.Nelson]: {
      name: "Nelson",
      path: "M230 240 C235 240, 238 245, 235 250 C232 248, 230 245, 230 240 Z",
      labelPos: [245, 235] // Callout
    },
    [RegionId.Marlborough]: {
      name: "Marlborough",
      path: "M235 240 C250 245, 260 255, 255 275 C245 280, 235 270, 235 255 C235 250, 235 240, 235 240 Z",
      labelPos: [260, 260]
    },
    [RegionId.WestCoast]: {
      name: "West Coast",
      path: "M210 270 C190 280, 180 300, 160 330 C150 340, 180 350, 190 330 C200 310, 210 290, 220 275 Z",
      labelPos: [170, 310]
    },
    [RegionId.Canterbury]: {
      name: "Canterbury",
      path: "M220 275 C240 280, 255 290, 240 330 C230 350, 210 360, 200 350 C210 330, 215 300, 220 275 Z",
      labelPos: [230, 310]
    },
    [RegionId.Otago]: {
      name: "Otago",
      path: "M190 330 C210 350, 200 370, 180 390 C160 380, 150 370, 150 360 C160 350, 170 340, 190 330 Z",
      labelPos: [180, 365]
    },
    [RegionId.Southland]: {
      name: "Southland",
      path: "M150 360 C140 370, 130 380, 135 390 C150 400, 170 395, 180 390 C170 380, 160 370, 150 360 Z",
      labelPos: [145, 385]
    },
    [RegionId.ChathamIslands]: {
      name: "Chatham Is.",
      path: "M400 300 L420 300 L420 315 L400 315 Z",
      labelPos: [410, 330]
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-50 rounded-xl overflow-hidden flex flex-col items-center justify-center border border-slate-200 shadow-inner">
      <svg 
        viewBox="0 0 500 450" 
        className="w-full h-full drop-shadow-md"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Ocean Background handled by container div, but we can add subtle waves if needed */}
        
        <g transform="translate(20, 20) scale(1.1)">
          {Object.entries(regions).map(([id, { path, name }]) => {
            const regionId = id as RegionId;
            const isFocused = focusedRegions.includes(regionId);
            const isHighlighted = highlightedRegions.includes(regionId);
            
            // Style Logic
            let fill = "fill-slate-200";
            let stroke = "stroke-white";
            let opacity = "opacity-100";
            let zIndex = 0;

            if (focusedRegions.length > 0) {
              if (isFocused) {
                fill = "fill-indigo-500";
                stroke = "stroke-indigo-600";
                zIndex = 10;
              } else {
                fill = "fill-slate-200";
                opacity = "opacity-40";
              }
            } else if (isHighlighted) {
              fill = "fill-indigo-300";
              stroke = "stroke-indigo-400";
            } else {
              fill = "fill-slate-200";
              stroke = "stroke-slate-100";
            }

            return (
              <path
                key={id}
                d={path}
                className={`transition-all duration-500 ease-in-out stroke-[1.5px] ${fill} ${stroke} ${opacity} hover:brightness-95`}
                style={{ zIndex }}
              >
                <title>{name}</title>
              </path>
            );
          })}

          {/* Labels Layer - Rendered after to sit on top */}
          {Object.entries(regions).map(([id, { name, labelPos }]) => {
             const regionId = id as RegionId;
             const isFocused = focusedRegions.includes(regionId);
             const isHighlighted = highlightedRegions.includes(regionId);
             
             // Only show labels for active/focused regions or if map is in neutral state to avoid clutter
             const shouldShowLabel = isFocused || (focusedRegions.length === 0);
             
             if (!shouldShowLabel) return null;

             const textColor = isFocused ? "fill-white font-bold" : (isHighlighted ? "fill-indigo-900 font-semibold" : "fill-slate-400 font-medium");
             
             return (
               <text
                 key={`label-${id}`}
                 x={labelPos[0]}
                 y={labelPos[1]}
                 className={`text-[8px] pointer-events-none select-none transition-all duration-300 ${textColor}`}
                 textAnchor="middle"
                 dominantBaseline="middle"
                 style={{ textShadow: '0px 1px 2px rgba(255,255,255,0.8)' }}
               >
                 {name}
               </text>
             );
          })}
        </g>
      </svg>
      
      {/* Dynamic Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-sm border border-slate-100 text-xs text-slate-600">
        <div className="font-semibold mb-2 text-slate-800">Map Key</div>
        <div className="flex items-center gap-2 mb-1.5">
           <span className="w-3 h-3 bg-indigo-500 rounded border border-indigo-600 shadow-sm"></span> Selected Holiday Region
        </div>
        <div className="flex items-center gap-2 mb-1.5">
           <span className="w-3 h-3 bg-indigo-300 rounded border border-indigo-400 shadow-sm"></span> Has Holiday This Month
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 bg-slate-200 rounded border border-slate-300 shadow-sm"></span> No Holiday
        </div>
      </div>
    </div>
  );
};

export default NZMap;