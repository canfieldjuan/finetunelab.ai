'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Target,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LabNote, categoryConfig } from '../lab-notes/data';

interface CaseStudiesViewProps {
  caseStudies: LabNote[];
}

export function CaseStudiesView({ caseStudies }: CaseStudiesViewProps) {
  const { user, signOut } = useAuth();

  return (
    <PageWrapper currentPage="case-studies" user={user} signOut={signOut}>
      <PageHeader
        title="Case Studies"
        description="Real-world results from fine-tuning experiments and production deployments"
      />

      {/* Intro Section */}
      <div className="mb-12 p-6 bg-muted/50 border rounded-lg">
        <div className="flex items-start gap-4">
          <Target className="w-8 h-8 text-primary mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Evidence-Based Fine-Tuning</h2>
            <p className="text-muted-foreground">
              See exactly how we solve complex problems using fine-tuned models. 
              These case studies detail the problem, the approach, the dataset iteration process, and the final metrics.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {caseStudies.map((note) => (
          <Link key={note.id} href={`/lab-notes/${note.slug}`}>
            <article className="p-6 border rounded-lg hover:shadow-lg transition-all duration-200 cursor-pointer group bg-card">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={categoryConfig[note.category].color}>
                      {categoryConfig[note.category].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {note.readTime}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                    {note.title}
                  </h3>

                  <p className="text-muted-foreground mb-4 text-lg">
                    {note.description}
                  </p>

                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    {note.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col justify-between items-end min-w-[150px]">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 md:mb-0">
                      <User className="w-4 h-4" />
                      <span>{note.author}</span>
                   </div>
                   <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      Read Case Study <ArrowRight className="w-4 h-4 ml-2" />
                   </Button>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </PageWrapper>
  );
}
