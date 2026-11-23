import React from 'react';
import { WeatherMode } from '../types/game';

interface WeatherIconProps {
  mode: WeatherMode;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({
  mode,
  className = 'w-4 h-4',
}) => {
  if (mode === 'clear') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    );
  }

  if (mode === 'dust') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10.5h11.5a2.5 2.5 0 1 0-2.5-2.5" />
        <path d="M4.5 15h13a2.2 2.2 0 1 1-2.2 2.2" />
        <circle cx="7" cy="6.2" r="1" fill="currentColor" stroke="none" />
        <circle cx="18.8" cy="7.5" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="10.2" cy="19" r="1" fill="currentColor" stroke="none" />
        <circle cx="20.2" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (mode === 'mist') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9h14" />
        <path d="M6.5 13h13.5" />
        <path d="M3.5 17h12.5" />
        <path d="M7 5.5a3.5 3.5 0 0 1 6.7-1.1A2.7 2.7 0 0 1 18 6.5" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 13.5h11a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.2 5.4a3.8 3.8 0 0 0-1.7 8.1Z" />
      <path d="M8.5 17l-1 2.8M12.5 17l-1 2.8M16.5 17l-1 2.8" />
    </svg>
  );
};
