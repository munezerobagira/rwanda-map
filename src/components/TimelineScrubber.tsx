'use client';

import React, { useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface TimelineScrubberProps {
  years: string[];
  value: string;
  onChange: (year: string) => void;
  /** Imagery source name shown beside the current year. */
  label: string;
}

const PLAY_INTERVAL_MS = 2000;

// Floating bottom-center scrubber for annual imagery mosaics: a slider with a
// notch per capture year, plus a play button that steps through the years as
// a time-lapse (and loops) so change over time is visible without clicking.
export default function TimelineScrubber({ years, value, onChange, label }: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const index = Math.max(0, years.indexOf(value));

  useEffect(() => {
    if (!isPlaying || years.length < 2) return;
    const timer = setInterval(() => {
      const next = (years.indexOf(value) + 1) % years.length;
      onChange(years[next]);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPlaying, years, value, onChange]);

  if (years.length === 0) return null;

  return (
    <div className="glass-panel flex items-center gap-4 pl-2 pr-5 py-2 pointer-events-auto w-full">
      <button
        onClick={() => setIsPlaying((p) => !p)}
        disabled={years.length < 2}
        aria-label={isPlaying ? 'Pause time-lapse' : 'Play time-lapse'}
        title={isPlaying ? 'Pause' : 'Play through years'}
        className="w-9 h-9 shrink-0 rounded-full bg-accent text-white flex items-center justify-center hover:brightness-110 disabled:opacity-40 transition"
      >
        {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={years.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(years[Number(e.target.value)])}
          aria-label="Imagery year"
          aria-valuetext={value}
          className="timeline-range block"
        />
        <div className="flex justify-between mt-0.5 px-[2px]">
          {years.map((yr, i) => (
            <button
              key={yr}
              onClick={() => onChange(yr)}
              tabIndex={-1}
              className={`text-[11px] font-mono tabular transition-colors ${
                i === index ? 'text-fg font-semibold' : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-right hidden sm:block">
        <span className="eyebrow block !text-[10px]">{label}</span>
        <span className="text-[15px] font-mono tabular font-semibold text-fg">{value}</span>
      </div>
    </div>
  );
}
