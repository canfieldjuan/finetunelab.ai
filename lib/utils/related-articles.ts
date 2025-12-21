import { LabNote } from '@/app/lab-notes/data';
import { AcademyArticle } from '@/lib/academy/content';

interface RelatedArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  type: 'lab-note' | 'academy';
}

/**
 * Get related articles based on tags, category, and relevance
 * Returns mix of Lab Notes and Academy articles
 */
export function getRelatedArticles(
  currentSlug: string,
  currentTags: string[],
  currentCategory: string,
  allLabNotes: LabNote[],
  allAcademyArticles: AcademyArticle[],
  limit = 3
): RelatedArticle[] {
  const related: Array<RelatedArticle & { score: number }> = [];

  // Score Lab Notes
  allLabNotes.forEach((note) => {
    if (note.slug === currentSlug) return; // Skip current article
    
    let score = 0;
    
    // Same category = +3 points
    if (note.category === currentCategory) score += 3;
    
    // Shared tags = +2 points per tag
    const sharedTags = note.tags.filter(tag => currentTags.includes(tag));
    score += sharedTags.length * 2;
    
    // Featured articles get bonus
    if (note.featured) score += 1;
    
    if (score > 0) {
      related.push({
        slug: note.slug,
        title: note.title,
        description: note.description,
        category: note.category,
        readTime: note.readTime,
        type: 'lab-note',
        score,
      });
    }
  });

  // Score Academy Articles
  allAcademyArticles.forEach((article) => {
    if (article.slug === currentSlug) return;
    
    let score = 0;
    
    // Academy articles related to techniques/datasets get bonus for case-study articles
    if (currentCategory === 'case-study' && 
        (article.category === 'RAG' || article.category === 'Prompting')) {
      score += 2;
    }
    
    // Shared tags
    const sharedTags = article.tags.filter(tag => currentTags.includes(tag));
    score += sharedTags.length * 2;
    
    if (score > 0) {
      related.push({
        slug: article.slug,
        title: article.title,
        description: article.excerpt,
        category: article.category,
        readTime: article.readTime || '10 min',
        type: 'academy',
        score,
      });
    }
  });

  // Sort by score (highest first) and limit results
  return related
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _, ...article }) => article);
}
