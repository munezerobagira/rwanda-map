'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, MapPin, Crosshair, CornerDownLeft } from 'lucide-react';
import { ADMIN_LEVELS } from '@/lib/adminLevels';

export interface LocationSearchResult {
  level: string;
  label: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  area_km2?: number;
  lat: number;
  lng: number;
  bounds: [number, number, number, number];
}

interface SearchBarProps {
  onSelectResult: (result: LocationSearchResult) => void;
  onSelectCoordinate: (lat: number, lng: number) => void;
}

// "Sector, District, Province" line under each result, skipping whichever
// level the result itself names.
function describeParent(result: LocationSearchResult): string {
  const chain = [result.cell, result.sector, result.district, result.province].filter(
    (name, idx, arr) => name && name !== result.label && arr.indexOf(name) === idx
  );
  return chain.slice(0, 3).join(', ');
}

// Accepts "-1.9441, 30.0619" / "-1.9441 30.0619". Anything outside Rwanda's
// rough extent is treated as ordinary text rather than a coordinate.
function parseCoordinate(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -3.5 || lat > -0.5 || lng < 28.5 || lng > 31.5) return null;
  return { lat, lng };
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function SearchBar({ onSelectResult, onSelectCoordinate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const coordinate = useMemo(() => parseCoordinate(query), [query]);

  // Group results by tier, coarsest first, keeping a flat order for arrow keys
  const groups = useMemo(() => {
    return ADMIN_LEVELS.map((level) => ({
      level,
      items: results.filter((r) => r.level === level.key)
    })).filter((g) => g.items.length > 0);
  }, [results]);
  const flatResults = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const optionCount = (coordinate ? 1 : 0) + flatResults.length;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    setIsOpen(true);
    if (value.trim().length < 2 || parseCoordinate(value)) {
      setResults([]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || parseCoordinate(trimmed)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search-location?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (!controller.signal.aborted) setResults(data.results || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Location search failed', err);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Ctrl/Cmd+K or "/" focuses search from anywhere (except while typing elsewhere)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const choose = (index: number) => {
    if (coordinate && index === 0) {
      onSelectCoordinate(coordinate.lat, coordinate.lng);
    } else {
      const result = flatResults[index - (coordinate ? 1 : 0)];
      if (!result) return;
      onSelectResult(result);
      setQuery(result.label);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (optionCount ? (i + 1) % optionCount : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (optionCount ? (i - 1 + optionCount) % optionCount : 0));
    } else if (e.key === 'Enter' && optionCount > 0) {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = isOpen && query.trim().length >= 2;
  const optionId = (i: number) => `search-option-${i}`;
  let runningIndex = coordinate ? 1 : 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2.5 bg-surface-elevated/70 border border-line rounded-lg px-3 h-9 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20 transition">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-fg-secondary shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          aria-activedescendant={showDropdown && optionCount ? optionId(activeIndex) : undefined}
          aria-label="Search places or coordinates"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search a place, or paste lat, lng"
          className="w-full bg-transparent border-none outline-none focus-visible:outline-none text-[13px] text-fg placeholder:text-fg-muted"
        />
        <kbd className="hidden md:inline-flex items-center gap-0.5 shrink-0 text-[11px] font-mono text-fg-muted border border-line rounded px-1.5 py-0.5">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute top-full left-0 mt-2 w-full max-h-[min(420px,60vh)] overflow-y-auto glass-panel !bg-surface-elevated/95 z-[1200] py-1.5 animate-fade-in"
        >
          {coordinate && (
            <button
              id={optionId(0)}
              role="option"
              aria-selected={activeIndex === 0}
              onMouseEnter={() => setActiveIndex(0)}
              onClick={() => choose(0)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 ${activeIndex === 0 ? 'bg-surface-subtle/70' : ''}`}
            >
              <Crosshair className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[13px] text-fg">
                Go to <span className="font-mono tabular">{coordinate.lat.toFixed(5)}, {coordinate.lng.toFixed(5)}</span>
              </span>
            </button>
          )}

          {groups.map((group) => (
            <div key={group.level.id} role="group" aria-label={group.level.label}>
              <div className="px-3 pt-2.5 pb-1 eyebrow !text-[10px]">
                {group.level.label}s <span className="text-fg-muted normal-case tracking-normal font-medium">· {group.level.local}</span>
              </div>
              {group.items.map((result) => {
                const i = runningIndex++;
                const active = i === activeIndex;
                return (
                  <button
                    key={`${result.level}-${result.label}-${i}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(i)}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 ${active ? 'bg-surface-subtle/70' : ''}`}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: group.level.stroke.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-fg truncate">{result.label}</span>
                      {describeParent(result) && (
                        <span className="block text-[11px] text-fg-secondary truncate">{describeParent(result)}</span>
                      )}
                    </span>
                    {active && <CornerDownLeft className="w-3.5 h-3.5 text-fg-muted shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}

          {!coordinate && !isLoading && flatResults.length === 0 && (
            <div className="px-3 py-2.5 text-[13px] text-fg-secondary">No matching places.</div>
          )}
        </div>
      )}
    </div>
  );
}
