"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
import type { Benchmark, CreateBenchmarkRequest, TaskType } from '@/lib/benchmarks/types';
import { ShareButton } from '@/components/workspace/ShareButton';
import { VALIDATOR_REGISTRY, isValidValidatorId, getAvailableValidatorIds } from '@/lib/evaluation/validators/validator-registry';

// Use centralized validator registry
const AVAILABLE_VALIDATORS = Object.values(VALIDATOR_REGISTRY);

interface BenchmarkManagerProps {
  sessionToken: string;
}

export function BenchmarkManager({ sessionToken }: BenchmarkManagerProps) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<Benchmark | null>(null);

  // Filter state
  const [benchmarkSearch, setBenchmarkSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState<number>(25);

  const [formData, setFormData] = useState<CreateBenchmarkRequest>({
    name: '',
    description: '',
    task_type: 'code',
    pass_criteria: {
      min_score: 0.8,
      required_validators: [],
    },
    is_public: false,
  });

  console.log('[BenchmarkManager] Component mounted');

  const fetchBenchmarks = React.useCallback(async () => {
    console.log('[BenchmarkManager] Fetching benchmarks');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/benchmarks', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      console.log('[BenchmarkManager] Fetched benchmarks:', data.benchmarks?.length || 0);
      setBenchmarks(data.benchmarks || []);
    } catch (err) {
      console.error('[BenchmarkManager] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load benchmarks');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchBenchmarks();
    }
  }, [sessionToken, fetchBenchmarks]);

  // Filter benchmarks by search
  function getFilteredBenchmarks(): Benchmark[] {
    let filtered = benchmarks;

    // Filter by search
    if (benchmarkSearch.trim()) {
      const search = benchmarkSearch.toLowerCase();
      filtered = filtered.filter(benchmark =>
        benchmark.name.toLowerCase().includes(search) ||
        benchmark.description?.toLowerCase().includes(search) ||
        benchmark.task_type.toLowerCase().includes(search)
      );
    }

    // Apply display limit
    return filtered.slice(0, displayLimit);
  }

  async function createBenchmark() {
    console.log('[BenchmarkManager] Creating benchmark:', formData.name);
    setError(null);

    // Validate validator IDs before saving
    const invalidValidators = (formData.pass_criteria.required_validators || [])
      .filter(id => !isValidValidatorId(id));
    
    if (invalidValidators.length > 0) {
      setError(`Invalid validator IDs: ${invalidValidators.join(', ')}. ` +
              `Available validators: ${getAvailableValidatorIds().join(', ')}`);
      return;
    }

    try {
      const response = await fetch('/api/benchmarks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create: ${response.status}`);
      }

      console.log('[BenchmarkManager] Benchmark created successfully');
      setShowCreateForm(false);
      resetForm();
      await fetchBenchmarks();
    } catch (err) {
      console.error('[BenchmarkManager] Create error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create benchmark');
    }
  }

  async function updateBenchmark() {
    if (!editingBenchmark) return;
    
    console.log('[BenchmarkManager] Updating benchmark:', editingBenchmark.id);
    setError(null);

    // Validate validator IDs before saving
    const invalidValidators = (formData.pass_criteria.required_validators || [])
      .filter(id => !isValidValidatorId(id));
    
    if (invalidValidators.length > 0) {
      setError(`Invalid validator IDs: ${invalidValidators.join(', ')}. ` +
              `Available validators: ${getAvailableValidatorIds().join(', ')}`);
      return;
    }

    try {
      const response = await fetch(`/api/benchmarks/${editingBenchmark.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update: ${response.status}`);
      }

      console.log('[BenchmarkManager] Benchmark updated successfully');
      setEditingBenchmark(null);
      resetForm();
      await fetchBenchmarks();
    } catch (err) {
      console.error('[BenchmarkManager] Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update benchmark');
    }
  }

  async function deleteBenchmark(id: string, name: string) {
    if (!confirm(`Delete benchmark "${name}"? This cannot be undone.`)) {
      return;
    }
    
    console.log('[BenchmarkManager] Deleting benchmark:', id);
    setError(null);

    try {
      const response = await fetch(`/api/benchmarks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete: ${response.status}`);
      }

      console.log('[BenchmarkManager] Benchmark deleted successfully');
      await fetchBenchmarks();
    } catch (err) {
      console.error('[BenchmarkManager] Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete benchmark');
    }
  }

  function startEditing(benchmark: Benchmark) {
    setEditingBenchmark(benchmark);
    setShowCreateForm(false);
    setFormData({
      name: benchmark.name,
      description: benchmark.description || '',
      task_type: benchmark.task_type,
      pass_criteria: {
        min_score: benchmark.pass_criteria.min_score,
        required_validators: benchmark.pass_criteria.required_validators,
        custom_rules: benchmark.pass_criteria.custom_rules,
      },
      is_public: benchmark.is_public,
    });
  }

  function cancelEditing() {
    setEditingBenchmark(null);
    resetForm();
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      task_type: 'code',
      pass_criteria: { min_score: 0.8, required_validators: [] },
      is_public: false,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Benchmark Manager</CardTitle>
            <CardDescription>
              Create custom benchmarks to measure model performance against specific criteria
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} variant="secondary" size="sm">
            {showCreateForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showCreateForm ? 'Cancel' : 'New Benchmark'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="bg-gray-50 border rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Create New Benchmark</h3>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Python Code Quality"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of what this benchmark measures"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="task_type">Task Type *</Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(value: TaskType) => setFormData({ ...formData, task_type: value })}
                >
                  <SelectTrigger id="task_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Code Generation</SelectItem>
                    <SelectItem value="reasoning">Reasoning & Logic</SelectItem>
                    <SelectItem value="domain_qa">Domain Q&A</SelectItem>
                    <SelectItem value="structured_output">Structured Output</SelectItem>
                    <SelectItem value="rag">RAG (Retrieval)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="min_score">Minimum Score (0-1) *</Label>
                <Input
                  id="min_score"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.pass_criteria.min_score}
                  onChange={(e) => setFormData({
                    ...formData,
                    pass_criteria: {
                      ...formData.pass_criteria,
                      min_score: parseFloat(e.target.value) || 0
                    }
                  })}
                  placeholder="0.8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum quality score required to pass (e.g., 0.8 = 80%)
                </p>
              </div>

              {/* Validator Selection */}
              <div>
                <Label className="mb-2 block">Required Validators (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select validators to run during batch testing
                </p>
                <div className="space-y-2">
                  {AVAILABLE_VALIDATORS.map(validator => {
                    const isSelected = formData.pass_criteria.required_validators?.includes(validator.id) || false;
                    return (
                      <label key={validator.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentValidators = formData.pass_criteria.required_validators || [];
                            const newValidators = e.target.checked
                              ? [...currentValidators, validator.id]
                              : currentValidators.filter(v => v !== validator.id);
                            
                            setFormData({
                              ...formData,
                              pass_criteria: {
                                ...formData.pass_criteria,
                                required_validators: newValidators.length > 0 ? newValidators : undefined,
                              }
                            });
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{validator.name}</div>
                          <div className="text-xs text-gray-500">{validator.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Rules (Advanced) */}
              <div>
                <Label htmlFor="custom_rules" className="mb-2 block">
                  Custom Rules (Optional, Advanced)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  JSON object with validator-specific configuration. Example: {`{"max_response_length": 500}`}
                </p>
                <Textarea
                  id="custom_rules"
                  value={formData.pass_criteria.custom_rules ? JSON.stringify(formData.pass_criteria.custom_rules, null, 2) : ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    let parsedRules;
                    
                    if (value) {
                      try {
                        parsedRules = JSON.parse(value);
                      } catch {
                        // Keep the invalid JSON in the textarea for user to fix
                        // Don't update formData until valid
                        return;
                      }
                    }
                    
                    setFormData({
                      ...formData,
                      pass_criteria: {
                        ...formData.pass_criteria,
                        custom_rules: parsedRules || undefined,
                      }
                    });
                  }}
                  placeholder='{"example_rule": "value"}'
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>

              {/* Is Public Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_public" className="cursor-pointer">
                  Make this benchmark public (visible to all users)
                </Label>
              </div>

              <Button onClick={createBenchmark} disabled={!formData.name} variant="secondary">
                <Save className="w-4 h-4 mr-2" />
                Create Benchmark
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        {!showCreateForm && benchmarks.length > 0 && (
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={benchmarkSearch}
                onChange={(e) => setBenchmarkSearch(e.target.value)}
                placeholder="Search benchmarks by name, description, or task type..."
                className="pl-10"
              />
            </div>
            <Select value={displayLimit.toString()} onValueChange={(v) => setDisplayLimit(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Show 10</SelectItem>
                <SelectItem value="25">Show 25</SelectItem>
                <SelectItem value="50">Show 50</SelectItem>
                <SelectItem value="100">Show 100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading benchmarks...</div>
        ) : benchmarks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No benchmarks yet. Create one to get started!
          </div>
        ) : getFilteredBenchmarks().length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No benchmarks match your search filters.
          </div>
        ) : (
          <div className="space-y-2">
            {getFilteredBenchmarks().map((benchmark) => (
              <div key={benchmark.id} className="border rounded-md p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{benchmark.name}</h4>
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                        {benchmark.task_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(benchmark.pass_criteria.min_score * 100).toFixed(0)}% min
                      </span>
                      {benchmark.pass_criteria.required_validators &&
                       benchmark.pass_criteria.required_validators.length > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          {benchmark.pass_criteria.required_validators.length} validator{benchmark.pass_criteria.required_validators.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {benchmark.description && (
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{benchmark.description}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <ShareButton
                      resourceType="benchmark"
                      resourceId={benchmark.id}
                      resourceName={benchmark.name}
                      variant="ghost"
                      size="sm"
                    />
                    <Button
                      onClick={() => startEditing(benchmark)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 h-8 w-8 p-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={() => deleteBenchmark(benchmark.id, benchmark.name)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Modal */}
      {editingBenchmark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Benchmark</h3>
              <Button onClick={cancelEditing} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid gap-4">
              {/* Same form fields as create */}
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Python Code Quality"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of what this benchmark measures"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-task_type">Task Type *</Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(value: TaskType) => setFormData({ ...formData, task_type: value })}
                >
                  <SelectTrigger id="edit-task_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Code Generation</SelectItem>
                    <SelectItem value="reasoning">Reasoning & Logic</SelectItem>
                    <SelectItem value="domain_qa">Domain Q&A</SelectItem>
                    <SelectItem value="structured_output">Structured Output</SelectItem>
                    <SelectItem value="rag">RAG (Retrieval)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-min_score">Minimum Score (0-1) *</Label>
                <Input
                  id="edit-min_score"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.pass_criteria.min_score}
                  onChange={(e) => setFormData({
                    ...formData,
                    pass_criteria: {
                      ...formData.pass_criteria,
                      min_score: parseFloat(e.target.value) || 0
                    }
                  })}
                  placeholder="0.8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum quality score required to pass (e.g., 0.8 = 80%)
                </p>
              </div>

              {/* Validator Selection */}
              <div>
                <Label className="mb-2 block">Required Validators (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select validators to run during batch testing
                </p>
                <div className="space-y-2">
                  {AVAILABLE_VALIDATORS.map(validator => {
                    const isSelected = formData.pass_criteria.required_validators?.includes(validator.id) || false;
                    return (
                      <label key={validator.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentValidators = formData.pass_criteria.required_validators || [];
                            const newValidators = e.target.checked
                              ? [...currentValidators, validator.id]
                              : currentValidators.filter(v => v !== validator.id);
                            
                            setFormData({
                              ...formData,
                              pass_criteria: {
                                ...formData.pass_criteria,
                                required_validators: newValidators.length > 0 ? newValidators : undefined,
                              }
                            });
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{validator.name}</div>
                          <div className="text-xs text-gray-500">{validator.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Rules */}
              <div>
                <Label htmlFor="edit-custom_rules" className="mb-2 block">
                  Custom Rules (Optional, Advanced)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  JSON object with validator-specific configuration. Example: {`{"max_response_length": 500}`}
                </p>
                <Textarea
                  id="edit-custom_rules"
                  value={formData.pass_criteria.custom_rules ? JSON.stringify(formData.pass_criteria.custom_rules, null, 2) : ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    let parsedRules;
                    
                    if (value) {
                      try {
                        parsedRules = JSON.parse(value);
                      } catch {
                        return;
                      }
                    }
                    
                    setFormData({
                      ...formData,
                      pass_criteria: {
                        ...formData.pass_criteria,
                        custom_rules: parsedRules || undefined,
                      }
                    });
                  }}
                  placeholder='{"example_rule": "value"}'
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>

              {/* Is Public Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is_public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-is_public" className="cursor-pointer">
                  Make this benchmark public (visible to all users)
                </Label>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={updateBenchmark} disabled={!formData.name} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button onClick={cancelEditing} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
