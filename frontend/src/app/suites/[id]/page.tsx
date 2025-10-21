'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Separator } from '@/components/ui/separator';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

import {
  TestTube,
  FileText,
  Eye,
  BarChart3,
  Clock,
  ArrowLeft,
  Play,
  List,
  Download,
  Server,
  CheckCircle,
  XCircle,
  Settings,
  Activity,
  Database
} from 'lucide-react';
import Link from 'next/link';

import { apiClient } from '@/lib/api';
import { Suite, Dataset, SuiteConfig } from '@/lib/types';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import WorkflowVisualization from '@/components/workflow-visualization';
import WorkflowEmptyState from '@/components/workflow-empty-state';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

export default function SuiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const suiteId = params.id as string;

  const [suite, setSuite] = useState<Suite | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [suiteConfig, setSuiteConfig] = useState<SuiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);


  const fetchSuiteDetails = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch suite details
      const suiteResponse = await apiClient.getSuite(suiteId);
      setSuite(suiteResponse);

      // Fetch associated dataset if suite has dataset_id
      if (suiteResponse.dataset_id) {
        try {
          const datasetResponse = await apiClient.getDataset(suiteResponse.dataset_id);
          setDataset(datasetResponse);
        } catch (error) {
          console.error('Failed to fetch associated dataset:', error);
        }
      }

      // Fetch suite configuration
      try {
        const configResponse = await apiClient.getSuiteConfig(suiteId);
        setSuiteConfig(configResponse);
      } catch (error) {
        console.error('Failed to fetch suite configuration:', error);
        // Set empty config if not found
        setSuiteConfig({
          suite_id: suiteId,
          workflow_config: null
        });
      }
    } catch (error) {
      toast.error('Failed to load suite details');
      console.error('Suite detail error:', error);
    } finally {
      setLoading(false);
    }
  }, [suiteId]);

  useEffect(() => {
    if (suiteId) {
      fetchSuiteDetails();
    }
  }, [suiteId, fetchSuiteDetails]);



  const handleCreateWorkflow = useCallback(async () => {
    try {
      // First, hit the configure workflow endpoint
      await apiClient.configureWorkflow(suiteId);

      // Then navigate to the edit page
      window.location.href = `/suites/${suiteId}/edit`;
    } catch (error) {
      console.error('Error configuring workflow:', error);
      toast.error('Failed to configure workflow');
    }
  }, [suiteId]);



  const getStatusBadge = useCallback((status: string) => {
    switch (status.toUpperCase()) {
      case 'READY':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Ready
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-blue-500">
            <Activity className="h-3 w-3" />
            Running
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Unknown
          </Badge>
        );
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="text-center py-12">
        <TestTube className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold">Suite not found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The suite you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push('/suites')}>
            Back to Suites
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back Button Row */}
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push('/suites')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Suites
          </Button>
        </div>

        {/* Title Row */}
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <TestTube className="mr-3 h-8 w-8" />
            {suite.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {suite.description || 'No description provided'}
          </p>
        </div>
      </div>

      {/* Overview Section */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Create Evaluation
            </Button>
            <Button variant="outline" className="w-full">
              <List className="mr-2 h-4 w-4" />
              View Evaluation
            </Button>
            <Button variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export Config
            </Button>
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Show Logs
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="mx-auto w-full max-w-4xl">
                  <DrawerHeader>
                    <DrawerTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Evaluation History & Logs
                    </DrawerTitle>
                    <DrawerDescription>
                      Complete history of all evaluations for {suite.name}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 pb-0">
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">No evaluation history</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        No evaluations have been run for this suite yet.
                      </p>
                    </div>
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button variant="outline">Close</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
            <Button variant="outline" className="w-full">
              <Server className="mr-2 h-4 w-4" />
              Show in MinIO
            </Button>

          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Suite Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Suite Metadata */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                <p className="text-sm">{formatDate(suite.created_at)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Last Updated</h4>
                <p className="text-sm">{formatDate(suite.updated_at)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                <div className="flex items-center">
                  {getStatusBadge(suite.status)}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Associated Dataset</h4>
                <div className="flex items-center">
                  {dataset ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Link href={`/datasets/${dataset.id}`}>
                          <Badge variant="outline" className="flex items-center gap-1 hover:bg-accent cursor-pointer">
                            <Database className="h-3 w-3" />
                            {dataset.name}
                          </Badge>
                        </Link>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <div className="space-y-1">
                          <h4 className="text-xl font-bold flex items-center gap-2">
                            <Database className="h-6 w-6" />
                            {dataset.name}
                          </h4>
                          {dataset.description && (
                            <p className="text-sm">
                              {dataset.description}
                            </p>
                          )}
                          <div className="flex items-center pt-2">
                            <span className="text-xs text-muted-foreground">
                              Updated {formatDate(dataset.updated_at)}
                            </span>
                          </div>
                          {dataset.total_rows && (
                            <div className="flex items-center pt-2">
                              <span className="text-xs text-muted-foreground">
                                Rows: {dataset.total_rows.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      No dataset associated
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <TestTube className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">0</div>
                <p className="text-sm text-muted-foreground">Total Evaluations</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">0</div>
                <p className="text-sm text-muted-foreground">Successful Runs</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">—</div>
                <p className="text-sm text-muted-foreground">Last Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Workflow Visualization
            </div>
            {suiteConfig?.workflow_config && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/suites/${suiteId}/edit`)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Edit Configuration
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Visual representation of your evaluation pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suiteConfig?.workflow_config ? (
            <WorkflowVisualization
              workflowConfig={suiteConfig.workflow_config}
              onCreateWorkflow={handleCreateWorkflow}
              onEditStep={(stepName: string) => {
                // Navigate to step editing - you can implement this based on your needs
                toast.info(`Edit ${stepName} step functionality coming soon`);
              }}
              isReadOnly={false}
            />
          ) : (
            <WorkflowEmptyState onCreateWorkflow={handleCreateWorkflow} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}