/**
 * Terminal Components - Index
 * 
 * Re-exports all terminal UI components for easy importing
 * Phase 2 & 3: ASCII Rendering + Layout Assembly
 * 
 * Date: 2025-11-01
 */

// Phase 2: ASCII Rendering Components
export { ASCIIProgressBar, type ASCIIProgressBarProps } from './ASCIIProgressBar';
export { ASCIISparkline, type ASCIISparklineProps } from './ASCIISparkline';
export { ASCIIBox, type ASCIIBoxProps } from './ASCIIBox';
export { MetricDisplay, type MetricDisplayProps } from './MetricDisplay';
export { LogStream, type LogStreamProps } from './LogStream';
export { KeyboardShortcuts, type KeyboardShortcutsProps, type ShortcutAction } from './KeyboardShortcuts';

// Phase 3: Layout Assembly Components
export { TerminalHeader, type TerminalHeaderProps } from './TerminalHeader';
export { TerminalProgress, type TerminalProgressProps } from './TerminalProgress';
export { TerminalMetrics, type TerminalMetricsProps } from './TerminalMetrics';
export { TerminalGPU, type TerminalGPUProps } from './TerminalGPU';
export { TerminalPerformance, type TerminalPerformanceProps } from './TerminalPerformance';
export { TerminalCheckpoint, type TerminalCheckpointProps } from './TerminalCheckpoint';
export { TerminalMonitor, type TerminalMonitorProps } from './TerminalMonitor';
