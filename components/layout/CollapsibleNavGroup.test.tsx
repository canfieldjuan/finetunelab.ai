/**
 * CollapsibleNavGroup Component Test
 * Simple test to verify component renders correctly
 * Date: 2025-10-30
 * Phase 2: Component verification
 */

import React, { useState } from 'react';
import { CollapsibleNavGroup, NavItem } from './CollapsibleNavGroup';
import { Home, MessageSquare, Boxes } from 'lucide-react';

// Test data
const testItems: NavItem[] = [
  { id: 'welcome', href: '/welcome', icon: Home, label: 'Home' },
  { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Chat' },
  { id: 'models', href: '/models', icon: Boxes, label: 'Models' },
];

export function CollapsibleNavGroupTest() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="w-64 p-4 bg-secondary">
      <h2 className="text-lg font-bold mb-4">Component Test</h2>
      
      {/* Test: Collapsible Group */}
      <CollapsibleNavGroup
        id="test-group"
        label="Test Group"
        icon={Home}
        items={testItems}
        currentPage="chat"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        collapsible={true}
      />

      {/* Test: Non-Collapsible Group */}
      <CollapsibleNavGroup
        id="core-group"
        label="Core (Always Open)"
        icon={MessageSquare}
        items={testItems}
        currentPage="models"
        expanded={true}
        onToggle={() => {}}
        collapsible={false}
      />
    </div>
  );
}
