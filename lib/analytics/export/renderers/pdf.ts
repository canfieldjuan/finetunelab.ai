/**
 * PDF Report Renderer
 * Converts RenderedReport to PDF using pdfkit
 * Phase 4: PDF Rendering
 * Date: December 15, 2025
 */

import PDFDocument from 'pdfkit';
import type {
  RenderedReport,
  RenderedSection,
  SummaryContent,
  MetricsContent,
  ChartContent,
  TableContent,
  RecommendationsContent,
  BreakdownContent,
  AlertContent,
} from '../templates/types';

// Color palette
const COLORS = {
  primary: '#2563eb',
  secondary: '#1e40af',
  text: '#1a1a1a',
  textLight: '#6b7280',
  good: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  background: '#f9fafb',
  border: '#e5e7eb',
};

// Font sizes (balanced for readability)
const FONTS = {
  title: 24,
  sectionTitle: 14,
  subheading: 11,
  body: 10,
  small: 9,
};

// Line height multiplier (slight increase from default)
const LINE_HEIGHT = 1.2;

/**
 * Render a complete report to PDF buffer
 */
export async function renderReportToPdf(report: RenderedReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
        info: {
          Title: report.header || report.metadata.templateName,
          Author: 'FineTuneLab Analytics',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Render header
      renderHeader(doc, report);

      // Render each section
      for (const section of report.sections) {
        renderSection(doc, section);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render report header
 */
function renderHeader(doc: PDFKit.PDFDocument, report: RenderedReport): void {
  const startDate = new Date(report.metadata.dateRange.start).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const endDate = new Date(report.metadata.dateRange.end).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Blue header bar
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);

  // Title
  doc.fillColor('white')
    .fontSize(FONTS.title)
    .text(report.header || report.metadata.templateName, 50, 25, {
      width: doc.page.width - 100,
    });

  // Date range
  doc.fontSize(FONTS.body)
    .text(`${startDate} - ${endDate}`, 50, 55, {
      width: doc.page.width - 100,
    });

  // Reset position below header bar (80px header + 20px margin)
  doc.x = 50;
  doc.y = 100;
}

/**
 * Render a section
 */
function renderSection(doc: PDFKit.PDFDocument, section: RenderedSection): void {
  // Ensure we start at left margin
  doc.x = 50;

  // Only add new page if very close to bottom (leave room for title + some content)
  if (doc.y > doc.page.height - 80) {
    doc.addPage();
    doc.x = 50;
    doc.y = 50;
  }

  // Section title with proper line gap
  doc.fillColor(COLORS.primary)
    .fontSize(FONTS.sectionTitle)
    .lineGap(FONTS.sectionTitle * (LINE_HEIGHT - 1))
    .text(section.title, 50, doc.y, { underline: true });
  doc.moveDown(0.5);

  // Reset x position after title
  doc.x = 50;

  // Render content based on type
  renderSectionContent(doc, section);

  // Reset position after content
  doc.x = 50;
  doc.moveDown(1);
}

/**
 * Render section content based on type
 */
function renderSectionContent(doc: PDFKit.PDFDocument, section: RenderedSection): void {
  const content = section.content;

  switch (content.type) {
    case 'summary':
      renderSummaryContent(doc, content);
      break;
    case 'metrics':
      renderMetricsContent(doc, content);
      break;
    case 'chart':
      renderChartContent(doc, content);
      break;
    case 'table':
      renderTableContent(doc, content);
      break;
    case 'recommendations':
      renderRecommendationsContent(doc, content);
      break;
    case 'breakdown':
      renderBreakdownContent(doc, content);
      break;
    case 'alert':
      renderAlertContent(doc, content);
      break;
  }
}

/**
 * Render summary content
 */
function renderSummaryContent(doc: PDFKit.PDFDocument, content: SummaryContent): void {
  doc.x = 50;

  // Headline
  doc.fillColor(COLORS.text)
    .fontSize(FONTS.subheading)
    .lineGap(FONTS.subheading * (LINE_HEIGHT - 1))
    .text(content.headline, 50);
  doc.moveDown(0.5);

  // Highlights
  if (content.highlights.length > 0) {
    doc.fillColor(COLORS.good)
      .fontSize(FONTS.small)
      .lineGap(FONTS.small * (LINE_HEIGHT - 1))
      .text('HIGHLIGHTS', 50);
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.body)
      .lineGap(FONTS.body * (LINE_HEIGHT - 1));
    content.highlights.forEach(h => {
      doc.text(`  + ${h}`, 50);
    });
    doc.moveDown(0.5);
  }

  // Concerns
  if (content.concerns.length > 0) {
    doc.fillColor(COLORS.critical)
      .fontSize(FONTS.small)
      .lineGap(FONTS.small * (LINE_HEIGHT - 1))
      .text('AREAS OF CONCERN', 50);
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.body)
      .lineGap(FONTS.body * (LINE_HEIGHT - 1));
    content.concerns.forEach(c => {
      doc.text(`  ! ${c}`, 50);
    });
  }

  doc.x = 50;
}

/**
 * Render metrics content
 */
function renderMetricsContent(doc: PDFKit.PDFDocument, content: MetricsContent): void {
  const pageWidth = doc.page.width - 100;
  const colWidth = pageWidth / 3;
  const startX = 50;
  const boxHeight = 52;
  const boxGap = 8;
  let currentY = doc.y;
  let col = 0;

  content.metrics.forEach((metric) => {
    const x = startX + (col * colWidth);
    const y = currentY;

    // Draw metric box background
    doc.rect(x, y, colWidth - 10, boxHeight)
      .fill(COLORS.background);

    // Status indicator bar on left
    const statusColor = metric.status === 'good' ? COLORS.good :
      metric.status === 'warning' ? COLORS.warning :
        metric.status === 'critical' ? COLORS.critical : COLORS.border;
    doc.rect(x, y, 4, boxHeight).fill(statusColor);

    // Label (uppercase, small, light) - positioned at top
    doc.fillColor(COLORS.textLight)
      .fontSize(FONTS.small)
      .lineGap(0)
      .text(metric.label.toUpperCase(), x + 10, y + 6, {
        width: colWidth - 25,
        lineBreak: false,
      });

    // Value (larger) - positioned in middle
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.subheading)
      .lineGap(0)
      .text(String(metric.value), x + 10, y + 20, {
        width: colWidth - 25,
        lineBreak: false,
      });

    // Trend indicator - positioned at bottom
    if (metric.trend) {
      const trendSymbol = metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : '=';
      const trendColor = metric.trend === 'up' ? COLORS.good :
        metric.trend === 'down' ? COLORS.critical : COLORS.textLight;
      const changeText = metric.changePercent !== undefined
        ? `${trendSymbol}${Math.abs(metric.changePercent).toFixed(1)}%`
        : trendSymbol;
      doc.fillColor(trendColor)
        .fontSize(FONTS.small)
        .lineGap(0)
        .text(changeText, x + 10, y + 36, {
          width: colWidth - 25,
          lineBreak: false,
        });
    }

    col++;
    if (col >= 3) {
      col = 0;
      currentY += boxHeight + boxGap;
    }
  });

  // Calculate final Y position after all metrics
  const totalRows = Math.ceil(content.metrics.length / 3);
  const finalY = currentY + (col > 0 ? boxHeight + boxGap : 0);

  // Reset position
  doc.x = 50;
  doc.y = finalY;
}

/**
 * Render chart content (as table since PDF doesn't support interactive charts)
 */
function renderChartContent(doc: PDFKit.PDFDocument, content: ChartContent): void {
  doc.x = 50;
  doc.fillColor(COLORS.text)
    .fontSize(FONTS.body)
    .lineGap(FONTS.body * (LINE_HEIGHT - 1))
    .text(`${content.title} (${content.chartType} chart)`, 50);
  doc.moveDown(0.5);

  // Render as simple table
  const headers = ['Label', ...content.datasets.map(ds => ds.label)];
  const rows = content.labels.map((label, i) => {
    return [label, ...content.datasets.map(ds => String(ds.data[i]))];
  });

  renderTable(doc, headers, rows);
}

/**
 * Render table content
 */
function renderTableContent(doc: PDFKit.PDFDocument, content: TableContent): void {
  doc.x = 50;
  renderTable(doc, content.headers, content.rows.map(row => row.map(String)));

  if (content.footer) {
    doc.fillColor(COLORS.textLight)
      .fontSize(FONTS.small)
      .lineGap(FONTS.small * (LINE_HEIGHT - 1))
      .text(content.footer, 50);
  }
}

/**
 * Helper: Calculate text height for a given width
 */
function getTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number): number {
  doc.fontSize(fontSize);
  const lineHeight = fontSize * 1.2;
  const words = text.split(' ');
  let lines = 1;
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.widthOfString(testLine);
    if (testWidth > width && currentLine) {
      lines++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  return lines * lineHeight;
}

/**
 * Helper: Render a table with dynamic row heights
 */
function renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]): void {
  const pageWidth = doc.page.width - 100;
  const colCount = headers.length;
  const colWidth = pageWidth / colCount;
  const minRowHeight = 18;
  const cellPadding = 4;
  const startX = 50;
  let y = doc.y;

  // Check if table header fits on page
  if (y + minRowHeight * 2 > doc.page.height - 50) {
    doc.addPage();
    doc.x = 50;
    y = 50;
  }

  // Header row
  doc.rect(startX, y, pageWidth, minRowHeight).fill(COLORS.background);
  headers.forEach((header, i) => {
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.small)
      .lineGap(0)
      .text(header, startX + (i * colWidth) + cellPadding, y + cellPadding, {
        width: colWidth - (cellPadding * 2),
        lineBreak: false,
      });
  });
  y += minRowHeight;

  // Data rows with dynamic height
  rows.forEach((row, rowIndex) => {
    // Calculate row height based on tallest cell
    let maxCellHeight = minRowHeight;
    row.forEach((cell) => {
      const cellHeight = getTextHeight(doc, cell, colWidth - (cellPadding * 2), FONTS.small) + (cellPadding * 2);
      maxCellHeight = Math.max(maxCellHeight, cellHeight);
    });
    // Cap row height to prevent extremely tall rows
    const rowHeight = Math.min(maxCellHeight, 60);

    // Check for page break
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      doc.x = 50;
      y = 50;
    }

    // Row background
    const bgColor = rowIndex % 2 === 0 ? '#ffffff' : COLORS.background;
    doc.rect(startX, y, pageWidth, rowHeight).fill(bgColor);

    // Cell text with wrapping
    row.forEach((cell, i) => {
      doc.fillColor(COLORS.text)
        .fontSize(FONTS.small)
        .lineGap(1)
        .text(cell, startX + (i * colWidth) + cellPadding, y + cellPadding, {
          width: colWidth - (cellPadding * 2),
          height: rowHeight - (cellPadding * 2),
          ellipsis: true,
        });
    });

    // Bottom border
    doc.strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + pageWidth, y + rowHeight)
      .stroke();

    y += rowHeight;
  });

  // Reset position after table
  doc.x = 50;
  doc.y = y + 8;
}

/**
 * Render recommendations content
 */
function renderRecommendationsContent(doc: PDFKit.PDFDocument, content: RecommendationsContent): void {
  doc.x = 50;

  content.items.forEach((item) => {
    // Check for page break - only if very close to bottom
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      doc.x = 50;
      doc.y = 50;
    }

    const priorityColor = item.priority === 'high' ? COLORS.critical :
      item.priority === 'medium' ? COLORS.warning : COLORS.good;

    // Priority badge and title on same line
    doc.fillColor(priorityColor)
      .fontSize(FONTS.small)
      .lineGap(0)
      .text(`[${item.priority.toUpperCase()}] `, 50, doc.y, { continued: true });

    doc.fillColor(COLORS.text)
      .fontSize(FONTS.body)
      .text(item.title, { continued: false });

    // Description
    doc.fillColor(COLORS.textLight)
      .fontSize(FONTS.small)
      .lineGap(FONTS.small * (LINE_HEIGHT - 1))
      .text(item.description, 50);

    // Impact
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.small)
      .text(`Impact: ${item.impact}`, 50);

    // Actions list
    if (item.actions && item.actions.length > 0) {
      doc.fillColor(COLORS.textLight)
        .fontSize(FONTS.small);
      item.actions.forEach(action => {
        doc.text(`  - ${action}`, 50);
      });
    }

    doc.moveDown(0.6);
    doc.x = 50;
  });
}

/**
 * Render breakdown content
 */
function renderBreakdownContent(doc: PDFKit.PDFDocument, content: BreakdownContent): void {
  // Ensure we start at left margin
  doc.x = 50;

  doc.fillColor(COLORS.text)
    .fontSize(FONTS.body)
    .lineGap(0)
    .text(content.title, 50);
  doc.moveDown(0.3);

  const pageWidth = doc.page.width - 100;
  const barMaxWidth = pageWidth - 160;
  const barHeight = 14;
  const barGap = 4;
  let currentY = doc.y;

  content.items.forEach(item => {
    // Check for page break - only if very close to bottom
    if (currentY > doc.page.height - 50) {
      doc.addPage();
      doc.x = 50;
      currentY = 50;
    }

    const barWidth = (item.percentage / 100) * barMaxWidth;

    // Background bar
    doc.rect(50, currentY, barMaxWidth, barHeight).fill(COLORS.background);

    // Value bar
    doc.rect(50, currentY, barWidth, barHeight).fill(COLORS.primary);

    // Label and value - position to the right of bars
    doc.fillColor(COLORS.text)
      .fontSize(FONTS.small)
      .lineGap(0)
      .text(
        `${item.label}: ${item.value} (${item.percentage.toFixed(1)}%)`,
        60 + barMaxWidth,
        currentY + 2,
        { width: 150, lineBreak: false }
      );

    currentY += barHeight + barGap;
  });

  // Reset position after breakdown
  doc.x = 50;
  doc.y = currentY + 5;
}

/**
 * Render alert content
 */
function renderAlertContent(doc: PDFKit.PDFDocument, content: AlertContent): void {
  // Ensure we start at left margin
  doc.x = 50;

  const alertColor = content.level === 'critical' ? COLORS.critical :
    content.level === 'warning' ? COLORS.warning : COLORS.primary;

  const pageWidth = doc.page.width - 100;
  const boxHeight = 48;
  const startY = doc.y;

  // Check for page break - only if box won't fit
  if (startY + boxHeight > doc.page.height - 50) {
    doc.addPage();
    doc.x = 50;
    doc.y = 50;
  }

  const boxY = doc.y;

  // Alert box background with border
  doc.rect(50, boxY, pageWidth, boxHeight)
    .fillAndStroke('#ffffff', alertColor);

  // Icon indicator bar on left
  doc.rect(50, boxY, 5, boxHeight).fill(alertColor);

  // Title - use stored boxY for positioning
  doc.fillColor(alertColor)
    .fontSize(FONTS.body)
    .lineGap(0)
    .text(`[${content.level.toUpperCase()}] ${content.title}`, 60, boxY + 8, {
      width: pageWidth - 20,
      lineBreak: false,
    });

  // Message - position below title
  doc.fillColor(COLORS.text)
    .fontSize(FONTS.small)
    .lineGap(0)
    .text(content.message, 60, boxY + 24, {
      width: pageWidth - 20,
      lineBreak: true,
    });

  // Reset position after alert box
  doc.x = 50;
  doc.y = boxY + boxHeight + 8;
}
