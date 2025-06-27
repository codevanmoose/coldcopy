'use client';

import React, { useState } from 'react';
import { Plus, Save, Trash2, Edit2, ChevronDown, ChevronRight, Settings, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConflictResolution, PipedriveFieldType } from '@/lib/integrations/pipedrive/types';

interface ConflictRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  entityType: 'person' | 'organization' | 'deal' | 'activity' | 'all';
  conflictType: 'field_conflict' | 'deletion_conflict' | 'creation_conflict' | 'relationship_conflict' | 'merge_conflict' | 'schema_conflict' | 'all';
  fieldPatterns: string[];
  conditions: RuleCondition[];
  resolutionStrategy: ConflictResolution;
  mergeConfig?: MergeConfig;
  requiresApproval: boolean;
  approvalRoles: string[];
}

interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_pattern';
  value: any;
  combineWith?: 'AND' | 'OR';
}

interface MergeConfig {
  defaultStrategy: 'latest' | 'earliest' | 'concatenate' | 'average' | 'sum' | 'union';
  fieldOverrides: Record<string, FieldMergeConfig>;
}

interface FieldMergeConfig {
  strategy: 'accept_local' | 'accept_remote' | 'merge' | 'custom';
  mergeType?: 'concatenate' | 'average' | 'sum' | 'latest' | 'earliest' | 'union' | 'intersection';
  delimiter?: string;
  unique?: boolean;
}

interface ConflictRulesEditorProps {
  rules: ConflictRule[];
  onSave: (rules: ConflictRule[]) => void;
  isLoading?: boolean;
}

export function ConflictRulesEditor({ rules: initialRules, onSave, isLoading = false }: ConflictRulesEditorProps) {
  const [rules, setRules] = useState<ConflictRule[]>(initialRules);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const handleAddRule = () => {
    const newRule: ConflictRule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      enabled: true,
      priority: rules.length + 1,
      entityType: 'all',
      conflictType: 'all',
      fieldPatterns: [],
      conditions: [],
      resolutionStrategy: ConflictResolution.LATEST_WINS,
      requiresApproval: false,
      approvalRoles: []
    };
    
    setRules([...rules, newRule]);
    setEditingRule(newRule.id);
    setExpandedRules(new Set([...expandedRules, newRule.id]));
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<ConflictRule>) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId));
  };

  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const newCondition: RuleCondition = {
      field: '',
      operator: 'equals',
      value: '',
      combineWith: 'AND'
    };

    handleUpdateRule(ruleId, {
      conditions: [...rule.conditions, newCondition]
    });
  };

  const handleUpdateCondition = (ruleId: string, conditionIndex: number, updates: Partial<RuleCondition>) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const newConditions = [...rule.conditions];
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], ...updates };

    handleUpdateRule(ruleId, { conditions: newConditions });
  };

  const handleDeleteCondition = (ruleId: string, conditionIndex: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    handleUpdateRule(ruleId, {
      conditions: rule.conditions.filter((_, index) => index !== conditionIndex)
    });
  };

  const handleAddFieldPattern = (ruleId: string, pattern: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || !pattern) return;

    handleUpdateRule(ruleId, {
      fieldPatterns: [...rule.fieldPatterns, pattern]
    });
  };

  const handleRemoveFieldPattern = (ruleId: string, index: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    handleUpdateRule(ruleId, {
      fieldPatterns: rule.fieldPatterns.filter((_, i) => i !== index)
    });
  };

  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const getStrategyLabel = (strategy: ConflictResolution) => {
    switch (strategy) {
      case ConflictResolution.LATEST_WINS: return 'Latest Wins';
      case ConflictResolution.PIPEDRIVE_WINS: return 'Pipedrive Wins';
      case ConflictResolution.COLDCOPY_WINS: return 'ColdCopy Wins';
      case ConflictResolution.MANUAL: return 'Manual Review';
      case ConflictResolution.FIELD_LEVEL: return 'Field Level Merge';
      default: return strategy;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Conflict Resolution Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure automatic conflict resolution strategies for different scenarios
          </p>
        </div>
        <Button onClick={handleAddRule} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No conflict resolution rules configured</p>
            <p className="text-sm text-gray-400 mt-2">
              Add rules to automatically handle data conflicts
            </p>
            <Button onClick={handleAddRule} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
            <Card key={rule.id} className={editingRule === rule.id ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <CollapsibleTrigger
                      onClick={() => toggleExpanded(rule.id)}
                      className="hover:bg-gray-100 p-1 rounded"
                    >
                      {expandedRules.has(rule.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </CollapsibleTrigger>
                    
                    <div>
                      {editingRule === rule.id ? (
                        <Input
                          value={rule.name}
                          onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                          className="font-semibold"
                        />
                      ) : (
                        <CardTitle className="text-base">{rule.name}</CardTitle>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Priority: {rule.priority}
                        </Badge>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getStrategyLabel(rule.resolutionStrategy)}
                        </Badge>
                        {rule.requiresApproval && (
                          <Badge variant="outline" className="text-xs">
                            Requires Approval
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => handleUpdateRule(rule.id, { enabled: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(editingRule === rule.id ? null : rule.id)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <Collapsible open={expandedRules.has(rule.id)}>
                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    {/* Basic Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entity Type</Label>
                        <Select
                          value={rule.entityType}
                          onValueChange={(value) => handleUpdateRule(rule.id, { entityType: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Entities</SelectItem>
                            <SelectItem value="person">Person</SelectItem>
                            <SelectItem value="organization">Organization</SelectItem>
                            <SelectItem value="deal">Deal</SelectItem>
                            <SelectItem value="activity">Activity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Conflict Type</Label>
                        <Select
                          value={rule.conflictType}
                          onValueChange={(value) => handleUpdateRule(rule.id, { conflictType: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="field_conflict">Field Conflict</SelectItem>
                            <SelectItem value="deletion_conflict">Deletion Conflict</SelectItem>
                            <SelectItem value="creation_conflict">Creation Conflict</SelectItem>
                            <SelectItem value="relationship_conflict">Relationship Conflict</SelectItem>
                            <SelectItem value="merge_conflict">Merge Conflict</SelectItem>
                            <SelectItem value="schema_conflict">Schema Conflict</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Resolution Strategy</Label>
                        <Select
                          value={rule.resolutionStrategy}
                          onValueChange={(value) => handleUpdateRule(rule.id, { resolutionStrategy: value as ConflictResolution })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ConflictResolution.LATEST_WINS}>Latest Wins</SelectItem>
                            <SelectItem value={ConflictResolution.PIPEDRIVE_WINS}>Pipedrive Wins</SelectItem>
                            <SelectItem value={ConflictResolution.COLDCOPY_WINS}>ColdCopy Wins</SelectItem>
                            <SelectItem value={ConflictResolution.MANUAL}>Manual Review</SelectItem>
                            <SelectItem value={ConflictResolution.FIELD_LEVEL}>Field Level Merge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) => handleUpdateRule(rule.id, { priority: parseInt(e.target.value) || 1 })}
                          min="1"
                        />
                      </div>
                    </div>

                    {editingRule === rule.id && (
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={rule.description || ''}
                          onChange={(e) => handleUpdateRule(rule.id, { description: e.target.value })}
                          placeholder="Describe when this rule should apply..."
                        />
                      </div>
                    )}

                    <Separator />

                    {/* Field Patterns */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Field Patterns</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const pattern = prompt('Enter field pattern (e.g., email*, custom_*)');
                            if (pattern) handleAddFieldPattern(rule.id, pattern);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Pattern
                        </Button>
                      </div>

                      {rule.fieldPatterns.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {rule.fieldPatterns.map((pattern, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="pl-3 pr-1 py-1"
                            >
                              {pattern}
                              <button
                                onClick={() => handleRemoveFieldPattern(rule.id, index)}
                                className="ml-2 hover:bg-gray-200 rounded p-0.5"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No field patterns defined (applies to all fields)</p>
                      )}
                    </div>

                    <Separator />

                    {/* Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Conditions</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddCondition(rule.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Condition
                        </Button>
                      </div>

                      {rule.conditions.length > 0 ? (
                        <div className="space-y-3">
                          {rule.conditions.map((condition, index) => (
                            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                              {index > 0 && (
                                <Select
                                  value={condition.combineWith || 'AND'}
                                  onValueChange={(value) => handleUpdateCondition(rule.id, index, { combineWith: value as 'AND' | 'OR' })}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AND">AND</SelectItem>
                                    <SelectItem value="OR">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              <Input
                                placeholder="Field name"
                                value={condition.field}
                                onChange={(e) => handleUpdateCondition(rule.id, index, { field: e.target.value })}
                                className="flex-1"
                              />

                              <Select
                                value={condition.operator}
                                onValueChange={(value) => handleUpdateCondition(rule.id, index, { operator: value as any })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="equals">Equals</SelectItem>
                                  <SelectItem value="not_equals">Not Equals</SelectItem>
                                  <SelectItem value="contains">Contains</SelectItem>
                                  <SelectItem value="greater_than">Greater Than</SelectItem>
                                  <SelectItem value="less_than">Less Than</SelectItem>
                                  <SelectItem value="matches_pattern">Matches Pattern</SelectItem>
                                </SelectContent>
                              </Select>

                              <Input
                                placeholder="Value"
                                value={condition.value}
                                onChange={(e) => handleUpdateCondition(rule.id, index, { value: e.target.value })}
                                className="flex-1"
                              />

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCondition(rule.id, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No conditions defined (always applies)</p>
                      )}
                    </div>

                    {/* Approval Settings */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={rule.requiresApproval}
                          onCheckedChange={(checked) => handleUpdateRule(rule.id, { requiresApproval: checked })}
                        />
                        <Label>Requires Manual Approval</Label>
                      </div>

                      {rule.requiresApproval && (
                        <Alert>
                          <Brain className="h-4 w-4" />
                          <AlertDescription>
                            Conflicts matching this rule will be queued for manual review before resolution
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={() => onSave(rules)} 
          disabled={isLoading}
          className="min-w-[100px]"
        >
          {isLoading ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Rules
            </>
          )}
        </Button>
      </div>
    </div>
  );
}