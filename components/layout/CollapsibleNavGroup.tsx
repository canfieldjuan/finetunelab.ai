/**
 * CollapsibleNavGroup Component
 * Reusable collapsible navigation group for sidebar
 * Date: 2025-10-30
 * Phase 2: Isolated component creation
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

export interface NavItem {
  id: string;
  href: string;
  icon: LucideIcon;
  label: string;
}

export interface CollapsibleNavGroupProps {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  currentPage: string;
  expanded: boolean;
  onToggle: () => void;
  collapsible: boolean;
}

export function CollapsibleNavGroup({
  id,
  label,
  items,
  currentPage,
  expanded,
  onToggle,
  collapsible,
}: CollapsibleNavGroupProps) {
  return (
    <div className="mb-2">
      {/* Group Header */}
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        className={`w-full text-left px-0 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide rounded-md flex items-center transition-colors ${
          collapsible ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={expanded}
        aria-controls={`nav-group-${id}`}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {collapsible && (
            <ChevronDown
              className="w-3.5 h-3.5"
              aria-hidden="true"
            />
          )}
        </div>
      </button>

      {/* Items - Always visible when not collapsible, or when expanded */}
      {(!collapsible || expanded) && (
        <div
          id={`nav-group-${id}`}
          className="mt-1 space-y-0.5 ml-2"
          role="group"
          aria-label={`${label} navigation`}
        >
          {items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = item.id === currentPage;

            return (
              <Link key={item.id} href={item.href} className="block">
                <button
                  type="button"
                  className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-muted'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <ItemIcon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
