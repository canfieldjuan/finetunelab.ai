'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Lightbulb, AlertCircle, Info, TrendingUp } from 'lucide-react';

interface Recommendation {
  id: string;
  category: 'model' | 'cache' | 'operation' | 'tokens' | 'timing';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potential_savings_usd: number;
  current_cost_usd: number;
  action: string;
}

interface RecommendationSummary {
  total_recommendations: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  total_potential_savings_usd: number;
}

export function EfficiencyRecommendations() {
  const { session } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<RecommendationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
 // eslint-disable-next-line react-hooks/exhaustive-deps

    // eslint-disable-next-line react-hooks/exhaustive-deps
    try {
      const res = await fetch('/api/analytics/efficiency-recommendations?timeRange=30d', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setRecommendations(json.data.recommendations || []);
        setSummary(json.data.summary);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Efficiency Recommendations</CardTitle>
            <Lightbulb className="h-5 w-5 text-yellow-500" />
          </div>
          <CardDescription>Cost optimization suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Lightbulb className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-green-700">Your usage is already optimized!</p>
            <p className="text-xs text-muted-foreground mt-1">No recommendations at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'medium':
        return <Info className="h-4 w-4 text-orange-500" />;
      case 'low':
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-orange-50 border-orange-200';
      case 'low':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      model: 'Model Selection',
      cache: 'Caching',
      operation: 'Operations',
      tokens: 'Token Usage',
      timing: 'Timing',
    };
    return labels[category] || category;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Efficiency Recommendations</CardTitle>
          <TrendingUp className="h-5 w-5 text-green-500" />
        </div>
        <CardDescription>
          {summary && (
            <span>
              {summary.total_recommendations} suggestions to save ${summary.total_potential_savings_usd.toFixed(2)}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`border rounded-lg p-4 ${getSeverityColor(rec.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(rec.severity)}
                  <span className="font-semibold text-sm">{rec.title}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    Save ${rec.potential_savings_usd.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCategoryLabel(rec.category)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-2">
                {rec.description}
              </p>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                <span className="text-xs font-medium">Action:</span>
                <span className="text-xs text-blue-600">{rec.action}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
