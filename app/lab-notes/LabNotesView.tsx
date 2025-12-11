'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  FlaskConical,
  TrendingUp,
  Database,
  GitCompare,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LabNote, categoryConfig } from './data';

interface LabNotesViewProps {
  notes: LabNote[];
}

export function LabNotesView({ notes }: LabNotesViewProps) {
  const { user, signOut } = useAuth();
  // Note: We do NOT redirect if not logged in, to allow SEO crawling.
  // The sidebar will just show public state or empty user.

  const featuredNotes = notes.filter(note => note.featured);
  const recentNotes = notes.filter(note => !note.featured);

  return (
    <PageWrapper currentPage="lab-notes" user={user} signOut={signOut}>
      <PageHeader
        title="Lab Notes"
        description="Research, experiments, and real results from the FineTune Lab team"
      />

      {/* Intro Section */}
      <div className="mb-12 p-6 bg-muted/50 border rounded-lg">
        <div className="flex items-start gap-4">
          <FlaskConical className="w-8 h-8 text-primary mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Real Experiments. Real Results.</h2>
            <p className="text-muted-foreground">
              This isn't a marketing blog. It's our lab journal. We document what we try, what works,
              what fails, and what we learn. Every fine-tuning technique we recommend has been tested here first.
            </p>
          </div>
        </div>
      </div>

      {/* Featured Articles */}
      {featuredNotes.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Featured
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredNotes.map((note) => (
              <Link key={note.id} href={`/lab-notes/${note.slug}`}>
                <article className="p-6 border rounded-lg hover:shadow-lg transition-all duration-200 cursor-pointer group h-full bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={categoryConfig[note.category].color}>
                      {categoryConfig[note.category].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {note.readTime}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {note.title}
                  </h3>

                  <p className="text-muted-foreground mb-4">
                    {note.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{note.author}</span>
                      <span>•</span>
                      <span>{note.publishedAt}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Articles */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Database className="w-6 h-6" />
          All Notes
        </h2>
        <div className="space-y-4">
          {recentNotes.map((note) => (
            <Link key={note.id} href={`/lab-notes/${note.slug}`}>
              <article className="p-4 border rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={categoryConfig[note.category].color}>
                        {categoryConfig[note.category].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{note.publishedAt}</span>
                      <span className="text-xs text-muted-foreground">• {note.readTime}</span>
                    </div>

                    <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                      {note.title}
                    </h3>

                    <p className="text-sm text-muted-foreground">
                      {note.description}
                    </p>

                    <div className="flex items-center gap-2 mt-3">
                      {note.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 bg-muted rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-2" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      {/* Categories Section */}
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/lab-notes?category=experiment" className="p-4 border rounded-lg hover:bg-muted transition-colors text-center">
            <FlaskConical className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold">Experiments</h3>
            <p className="text-xs text-muted-foreground">We tried it so you don't have to</p>
          </Link>
          <Link href="/lab-notes?category=technique" className="p-4 border rounded-lg hover:bg-muted transition-colors text-center">
            <GitCompare className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <h3 className="font-semibold">Techniques</h3>
            <p className="text-xs text-muted-foreground">Methods that actually work</p>
          </Link>
          <Link href="/lab-notes?category=case-study" className="p-4 border rounded-lg hover:bg-muted transition-colors text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold">Case Studies</h3>
            <p className="text-xs text-muted-foreground">Real projects, real results</p>
          </Link>
          <Link href="/lab-notes?category=dataset" className="p-4 border rounded-lg hover:bg-muted transition-colors text-center">
            <Database className="w-8 h-8 mx-auto mb-2 text-orange-600" />
            <h3 className="font-semibold">Dataset Insights</h3>
            <p className="text-xs text-muted-foreground">Data curation deep dives</p>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
