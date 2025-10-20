'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, Plus, Trash2, Brain, Activity, Target, Eye, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Metric {
  id: string;
  name: string;
  description: string;
  category: 'llm-judge' | 'vector' | 'statistical' | 'semantic' | 'factual';
  icon: React.ReactNode;
}

interface MetricsSelectorProps {
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  className?: string;
}

const PREDEFINED_METRICS: Metric[] = [
  {
    id: 'similarity',
    name: 'Similarity',
    description: 'Measures semantic similarity between texts',
    category: 'vector',
    icon: <Activity className="w-3 h-3" />
  },
  {
    id: 'accuracy',
    name: 'Accuracy',
    description: 'Overall correctness of predictions',
    category: 'statistical',
    icon: <Target className="w-3 h-3" />
  },
  {
    id: 'precision',
    name: 'Precision',
    description: 'Proportion of positive identifications that were correct',
    category: 'statistical',
    icon: <Target className="w-3 h-3" />
  },
  {
    id: 'recall',
    name: 'Recall',
    description: 'Proportion of actual positives that were identified correctly',
    category: 'statistical',
    icon: <Target className="w-3 h-3" />
  },
  {
    id: 'relevancy',
    name: 'Relevancy',
    description: 'How relevant the response is to the query',
    category: 'llm-judge',
    icon: <Brain className="w-3 h-3" />
  },
  {
    id: 'hallucination',
    name: 'Hallucination',
    description: 'Detects factually incorrect or made-up information',
    category: 'factual',
    icon: <AlertTriangle className="w-3 h-3" />
  },
  {
    id: 'coherence',
    name: 'Coherence',
    description: 'Logical flow and consistency of the response',
    category: 'llm-judge',
    icon: <Brain className="w-3 h-3" />
  },
  {
    id: 'fluency',
    name: 'Fluency',
    description: 'Language quality and readability',
    category: 'llm-judge',
    icon: <Brain className="w-3 h-3" />
  },
  {
    id: 'semantic-similarity',
    name: 'Semantic Similarity',
    description: 'Deep semantic understanding comparison',
    category: 'semantic',
    icon: <Eye className="w-3 h-3" />
  },
  {
    id: 'response-time',
    name: 'Response Time',
    description: 'Time taken to generate response',
    category: 'statistical',
    icon: <Zap className="w-3 h-3" />
  }
];

const CATEGORY_LABELS = {
  'llm-judge': { label: 'LLM as a Judge', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'vector': { label: 'Vector', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'statistical': { label: 'Statistical', color: 'bg-green-100 text-green-800 border-green-200' },
  'semantic': { label: 'Semantic', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'factual': { label: 'Factual', color: 'bg-red-100 text-red-800 border-red-200' }
};

export function MetricsSelector({ selectedMetrics, onMetricsChange, className }: MetricsSelectorProps) {
  const [open, setOpen] = useState(false);

  const addMetric = (metricId: string) => {
    if (!selectedMetrics.includes(metricId)) {
      onMetricsChange([...selectedMetrics, metricId]);
    }
    setOpen(false);
  };

  const removeMetric = (metricId: string) => {
    onMetricsChange(selectedMetrics.filter(id => id !== metricId));
  };

  const getMetricById = (id: string) => {
    return PREDEFINED_METRICS.find(metric => metric.id === id);
  };

  const availableMetrics = PREDEFINED_METRICS.filter(
    metric => !selectedMetrics.includes(metric.id)
  );

  const groupedMetrics = availableMetrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, Metric[]>);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <Label>Evaluation Metrics</Label>
        
        {/* Selected Metrics */}
        <div className="space-y-3">
          {selectedMetrics.map((metricId) => {
            const metric = getMetricById(metricId);
            if (!metric) return null;
            
            const categoryStyle = CATEGORY_LABELS[metric.category];
            
            return (
              <div key={metricId} className="group flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0">
                      {metric.icon}
                    </div>
                    <span className="font-medium text-sm truncate">{metric.name}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-xs flex-shrink-0", categoryStyle.color)}>
                    {categoryStyle.label}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {metric.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMetric(metricId)}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add Metric Combobox */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-start gap-2 h-10 text-muted-foreground hover:text-foreground border-dashed"
            >
              <Plus className="w-4 h-4" />
              Add Evaluation Metric
              <ChevronDown className="w-4 h-4 opacity-50 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[520px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search metrics..." />
              <CommandEmpty>No metrics found.</CommandEmpty>
              <CommandList className="max-h-[300px]">
                {Object.entries(groupedMetrics).map(([category, metrics]) => {
                  const categoryStyle = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
                  
                  return (
                    <CommandGroup 
                      key={category} 
                      heading={
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", categoryStyle.color)}>
                            {categoryStyle.label}
                          </Badge>
                        </div>
                      }
                    >
                      {metrics.map((metric) => (
                        <CommandItem
                          key={metric.id}
                          value={metric.name}
                          onSelect={() => addMetric(metric.id)}
                          className="flex items-start gap-3 p-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex-shrink-0">
                              {metric.icon}
                            </div>
                            <span className="font-medium text-sm">{metric.name}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {metric.description}
                            </p>
                          </div>
                          <Check
                            className={cn(
                              "w-4 h-4 flex-shrink-0 mt-0.5",
                              selectedMetrics.includes(metric.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedMetrics.length === 0 && (
          <div className="text-center py-8 px-4 border-2 border-dashed border-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              No metrics selected. Add metrics to evaluate your workflow results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}