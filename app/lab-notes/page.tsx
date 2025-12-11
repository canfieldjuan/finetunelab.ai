import React from 'react';
import { Metadata } from 'next';
import { LabNotesView } from './LabNotesView';
import { labNotes } from './data';
import { generateListingSchema } from './schema';

export const metadata: Metadata = {
  title: 'Lab Notes | FineTune Lab Research & Insights',
  description: 'Deep dives into fine-tuning experiments, dataset curation strategies, and model training techniques. Real results from real training runs.',
  openGraph: {
    title: 'Lab Notes | FineTune Lab Research & Insights',
    description: 'Deep dives into fine-tuning experiments, dataset curation strategies, and model training techniques.',
    type: 'website',
    siteName: 'FineTune Lab',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lab Notes | FineTune Lab Research & Insights',
    description: 'Deep dives into fine-tuning experiments, dataset curation strategies, and model training techniques.',
  },
};

export default function LabNotesPage() {
  const jsonLd = generateListingSchema(labNotes);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LabNotesView notes={labNotes} />
    </>
  );
}
