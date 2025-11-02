'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  BarChart3,
  Activity,
  Calendar,
  Database,
  TestTube,
  FileText,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface Evaluation {
  id: string;
  name: string;
  description: string;
  suite_id: string;
  dataset_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  started_at: string | null;
  completed_at: string | null;
  eval_metadata: Record<string, any>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface EvaluationDetailPageProps {
  params: {
    id: string;
  };
}

export default function EvaluationDetailPage({ params }: EvaluationDetailPageProps) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:8000/api/v1/evals/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Evaluation not found');
        }
        throw new Error('Failed to fetch evaluation details');
      }

      const data = await response.json();
      setEvaluation(data.data);
    } catch (error) {
      console.error('Error fetching evaluation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch evaluation details';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchEvaluation();
  }, [fetchEvaluation]);

  const getStatusIcon = (status: Evaluation['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Evaluation['status']) => {
    const variants = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {getStatusIcon(status)}
        <span className="ml-2">{status}</span>
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const calculateSuccessRate = (successful: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  };

  const calculateDuration = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return 'N/A';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading evaluation details...</p>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-semibold">Error Loading Evaluation</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error || 'Evaluation not found'}
          </p>
          <div className="mt-6 space-x-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button onClick={fetchEvaluation}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{evaluation.name}</h1>
            <p className="text-muted-foreground">
              {evaluation.description || 'No description provided'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(evaluation.status)}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(evaluation.total_requests)}</div>
            <p className="text-xs text-muted-foreground">
              Requests processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateSuccessRate(evaluation.successful_requests, evaluation.total_requests)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(evaluation.successful_requests)} successful
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Requests</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(evaluation.failed_requests)}
            </div>
            <p className="text-xs text-muted-foreground">
              Requests failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateDuration(evaluation.started_at, evaluation.completed_at)}
            </div>
            <p className="text-xs text-muted-foreground">
              Execution time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Evaluation Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Evaluation Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Evaluation ID</label>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                  {evaluation.id}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  {getStatusBadge(evaluation.status)}
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Suite ID</label>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                  {evaluation.suite_id}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dataset ID</label>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                  {evaluation.dataset_id}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{formatDate(evaluation.created_at)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Started</label>
              <p className="text-sm mt-1">{formatDate(evaluation.started_at)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Completed</label>
              <p className="text-sm mt-1">{formatDate(evaluation.completed_at)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm mt-1">{formatDate(evaluation.updated_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {evaluation.eval_metadata && Object.keys(evaluation.eval_metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Metadata
            </CardTitle>
            <CardDescription>
              Additional information and metrics for this evaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(evaluation.eval_metadata, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Available actions for this evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/suites/${evaluation.suite_id}`)}
            >
              <TestTube className="mr-2 h-4 w-4" />
              View Suite
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push(`/datasets/${evaluation.dataset_id}`)}
            >
              <Database className="mr-2 h-4 w-4" />
              View Dataset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}