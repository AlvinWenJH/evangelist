'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, Clock, Database, Settings, Send, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestResult {
  success: boolean;
  dataset_id: string;
  necessary_step: string[];
  results: Record<string, any>;
}

interface TestResultsDisplayProps {
  result: TestResult | null;
  isLoading: boolean;
  error: string | null;
  step: string;
}

const getStepIcon = (step: string) => {
  switch (step) {
    case 'load_data':
      return <Database className="h-4 w-4" />;
    case 'preprocessing':
      return <Settings className="h-4 w-4" />;
    case 'invocation':
      return <Send className="h-4 w-4" />;
    case 'postprocessing':
      return <Settings className="h-4 w-4" />;
    case 'evaluation':
      return <BarChart3 className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const formatStepName = (step: string) => {
  return step.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const renderStepResult = (stepName: string, stepResult: any) => {
  if (!stepResult) return null;

  return (
    <div key={stepName} className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        {getStepIcon(stepName)}
        <h4 className="font-medium">{formatStepName(stepName)}</h4>
        <Badge variant="secondary" className="ml-auto">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      </div>
      
      <ScrollArea className="max-h-40">
        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
          {JSON.stringify(stepResult, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
};

export default function TestResultsDisplay({ 
  result, 
  isLoading, 
  error, 
  step 
}: TestResultsDisplayProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 animate-spin" />
            Testing {formatStepName(step)}...
          </CardTitle>
          <CardDescription>
            Running test for the {step} step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Please wait...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Test Failed
          </CardTitle>
          <CardDescription>
            Error testing {step} step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          Test Results
        </CardTitle>
        <CardDescription>
          Test completed for {step} step
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Dataset ID: {result.dataset_id}</span>
          </div>
          <Badge variant="outline">
            {result.necessary_step.length} steps executed
          </Badge>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Step Results:</h4>
          {result.necessary_step.map(stepName => 
            renderStepResult(stepName, result.results[stepName])
          )}
        </div>
      </CardContent>
    </Card>
  );
}