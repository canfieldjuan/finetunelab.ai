import React from 'react';
import { Metadata } from 'next';
import { CaseStudiesView } from './CaseStudiesView';
import { labNotes } from '../lab-notes/data';
import { generateListingSchema } from '../lab-notes/schema';

export const metadata: Metadata = {
  title: 'Case Studies | FineTune Lab',
  description: 'Real-world examples of fine-tuning success. See how we improved model accuracy, reduced hallucinations, and solved complex reasoning tasks.',
  openGraph: {
    title: 'Fine-Tuning Case Studies | FineTune Lab',
    description: 'Real-world examples of fine-tuning success. See how we improved model accuracy, reduced hallucinations, and solved complex reasoning tasks.',
    type: 'website',
  },
};

export default function CaseStudiesPage() {
  const caseStudies = labNotes.filter(note => note.category === 'case-study');
  const jsonLd = generateListingSchema(caseStudies);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CaseStudiesView caseStudies={caseStudies} />
    </>
  );
}
