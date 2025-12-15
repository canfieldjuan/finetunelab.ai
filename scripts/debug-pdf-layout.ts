/**
 * Debug PDF layout issues
 */

import PDFDocument from 'pdfkit';
import { writeFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
  primary: '#2563eb',
  text: '#1a1a1a',
  textLight: '#6b7280',
  good: '#10b981',
  background: '#f9fafb',
};

const FONTS = {
  title: 24,
  sectionTitle: 16,
  subheading: 12,
  body: 10,
  small: 8,
};

async function debugPdf() {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const outputPath = join(process.cwd(), 'storage', 'sample-exports', 'debug-layout.pdf');

  console.log('=== PDF Layout Debug ===\n');

  // ISSUE 1: Header position
  console.log('1. Before header:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Draw header bar
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);

  console.log('2. After header rect:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Title at absolute position
  doc.fillColor('white')
    .fontSize(FONTS.title)
    .text('Test Report Title', 50, 25, { width: doc.page.width - 100 });

  console.log('3. After title text:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Date at absolute position
  doc.fontSize(FONTS.body)
    .text('December 1 - December 15, 2025', 50, 55, { width: doc.page.width - 100 });

  console.log('4. After date text:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // This moveDown doesn't work as expected!
  doc.moveDown(3);

  console.log('5. After moveDown(3):');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);
  console.log('   PROBLEM: doc.y should be ~100 (below 80px header), but it is not!\n');

  // FIX: Manually set doc.y after header
  doc.x = 50;
  doc.y = 100; // Below the 80px header + margin

  console.log('6. After manual fix:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Section title
  doc.fillColor(COLORS.primary)
    .fontSize(FONTS.sectionTitle)
    .text('Section 1: Overview', { underline: true });

  console.log('7. After section title:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  doc.moveDown(0.5);

  // Body text
  doc.fillColor(COLORS.text)
    .fontSize(FONTS.body)
    .text('This is body text that should appear below the section title.');

  console.log('8. After body text:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  doc.moveDown(1);

  // Section 2 with metrics boxes
  doc.fillColor(COLORS.primary)
    .fontSize(FONTS.sectionTitle)
    .text('Section 2: Metrics Grid', { underline: true });
  doc.moveDown(0.5);

  console.log('9. Before metrics:');
  console.log(`   doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Draw 3 metric boxes
  const startY = doc.y;
  const boxHeight = 50;
  const colWidth = (doc.page.width - 100) / 3;

  for (let i = 0; i < 3; i++) {
    const x = 50 + (i * colWidth);
    doc.rect(x, startY, colWidth - 10, boxHeight).fill(COLORS.background);

    // Text inside box - use absolute positioning
    doc.fillColor(COLORS.textLight)
      .fontSize(FONTS.small)
      .text(`METRIC ${i + 1}`, x + 10, startY + 5, { width: colWidth - 25 });

    doc.fillColor(COLORS.text)
      .fontSize(FONTS.subheading)
      .text(`$${(i + 1) * 100}.00`, x + 10, startY + 20, { width: colWidth - 25 });
  }

  console.log('10. After drawing boxes (doc.y not updated):');
  console.log(`    doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // FIX: Update doc.y manually after grid
  doc.x = 50;
  doc.y = startY + boxHeight + 15;

  console.log('11. After manual y fix:');
  console.log(`    doc.x = ${doc.x}, doc.y = ${doc.y}`);

  // Section 3
  doc.fillColor(COLORS.primary)
    .fontSize(FONTS.sectionTitle)
    .text('Section 3: After Metrics', { underline: true });
  doc.moveDown(0.5);

  doc.fillColor(COLORS.text)
    .fontSize(FONTS.body)
    .text('This text should appear below the metrics grid, not overlap with it.');

  console.log('\n=== Summary ===');
  console.log('The main issues are:');
  console.log('1. After absolute-positioned drawing (rect, text with x,y), doc.y is not updated');
  console.log('2. moveDown() only works relative to the last text position');
  console.log('3. Need to manually reset doc.x and doc.y after grids/boxes/absolute positioning');

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      writeFileSync(outputPath, buffer);
      console.log(`\nDebug PDF saved to: ${outputPath}`);
      resolve();
    });
  });
}

debugPdf().catch(console.error);
