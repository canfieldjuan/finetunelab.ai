'use client';

import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Globe, ExternalLink } from 'lucide-react';

interface SourceBadgeProps {
  domain: string;
  trustScore?: number; // 0-1 range
  isVerified?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SourceBadge({
  domain,
  trustScore,
  isVerified = false,
  showTooltip = true,
  size = 'md',
}: SourceBadgeProps) {
  // Determine trust level based on score
  const getTrustLevel = () => {
    if (!trustScore) return 'unknown';
    if (trustScore >= 0.8) return 'high';
    if (trustScore >= 0.5) return 'medium';
    return 'low';
  };

  const trustLevel = getTrustLevel();

  // Size classes
  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      badge: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'h-3.5 w-3.5',
    },
    lg: {
      badge: 'px-3 py-1.5 text-base gap-2',
      icon: 'h-4 w-4',
    },
  };

  // Color classes based on trust level
  const colorClasses = {
    high: {
      bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      icon: 'text-green-600 dark:text-green-400',
    },
    medium: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: 'text-yellow-600 dark:text-yellow-400',
    },
    low: {
      bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: 'text-red-600 dark:text-red-400',
    },
    unknown: {
      bg: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700',
      text: 'text-gray-700 dark:text-gray-300',
      icon: 'text-gray-600 dark:text-gray-400',
    },
  };

  // Icon selection
  const ShieldIcon =
    trustLevel === 'high'
      ? ShieldCheck
      : trustLevel === 'medium' || trustLevel === 'low'
      ? ShieldAlert
      : Shield;

  // Tooltip content
  const tooltipContent = trustScore
    ? `Trust Score: ${Math.round(trustScore * 100)}%${isVerified ? ' • Verified Source' : ''}`
    : 'Source information';

  return (
    <div
      className={`inline-flex items-center font-medium border rounded-md transition-colors duration-200 ${sizeClasses[size].badge} ${colorClasses[trustLevel].bg} ${colorClasses[trustLevel].text}`}
      title={showTooltip ? tooltipContent : undefined}
    >
      {/* Trust/Shield Icon */}
      {trustScore !== undefined && (
        <ShieldIcon className={`${sizeClasses[size].icon} ${colorClasses[trustLevel].icon} flex-shrink-0`} />
      )}

      {/* Globe Icon for unknown sources */}
      {trustScore === undefined && (
        <Globe className={`${sizeClasses[size].icon} ${colorClasses[trustLevel].icon} flex-shrink-0`} />
      )}

      {/* Domain Name */}
      <span className="truncate max-w-[150px]">{domain}</span>

      {/* Verified Badge */}
      {isVerified && (
        <svg
          className={`${sizeClasses[size].icon} text-blue-500 dark:text-blue-400 flex-shrink-0`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="Verified"
        >
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}

// Compact variant for space-constrained areas
export function SourceIcon({
  domain,
  trustScore,
  isVerified = false,
}: {
  domain: string;
  trustScore?: number;
  isVerified?: boolean;
}) {
  const getTrustLevel = () => {
    if (!trustScore) return 'unknown';
    if (trustScore >= 0.8) return 'high';
    if (trustScore >= 0.5) return 'medium';
    return 'low';
  };

  const trustLevel = getTrustLevel();

  const colorClasses = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-red-600 dark:text-red-400',
    unknown: 'text-gray-600 dark:text-gray-400',
  };

  const ShieldIcon =
    trustLevel === 'high'
      ? ShieldCheck
      : trustLevel === 'medium' || trustLevel === 'low'
      ? ShieldAlert
      : Globe;

  const tooltipContent = trustScore
    ? `${domain} - Trust: ${Math.round(trustScore * 100)}%${isVerified ? ' (Verified)' : ''}`
    : domain;

  return (
    <div className="relative inline-flex items-center" title={tooltipContent}>
      <ShieldIcon className={`h-4 w-4 ${colorClasses[trustLevel]}`} />
      {isVerified && (
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 dark:bg-blue-400 rounded-full border border-white dark:border-gray-900" />
      )}
    </div>
  );
}

// Link variant with external icon
export function SourceLink({
  domain,
  url,
  trustScore,
  isVerified = false,
}: {
  domain: string;
  url: string;
  trustScore?: number;
  isVerified?: boolean;
}) {
  const getTrustLevel = () => {
    if (!trustScore) return 'unknown';
    if (trustScore >= 0.8) return 'high';
    if (trustScore >= 0.5) return 'medium';
    return 'low';
  };

  const trustLevel = getTrustLevel();

  const colorClasses = {
    high: 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300',
    medium: 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300',
    low: 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300',
    unknown: 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-sm font-medium underline decoration-dotted underline-offset-2 transition-colors ${colorClasses[trustLevel]}`}
      title={`Visit ${domain}${trustScore ? ` (Trust: ${Math.round(trustScore * 100)}%)` : ''}`}
    >
      <span>{domain}</span>
      {isVerified && <span className="text-blue-500 dark:text-blue-400">✓</span>}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
