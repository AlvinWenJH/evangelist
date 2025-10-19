'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Database, Plus, TestTube, CheckCircle, Play, Clock, XCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Dataset, Suite } from '@/lib/types';
import { toast } from 'sonner';
import { formatDateShort } from '@/lib/date-utils';

export default function Dashboard() {
  const [recentDatasets, setRecentDatasets] = useState<Dataset[]>([]);
  const [recentSuites, setRecentSuites] = useState<Suite[]>([]);
  const [totalDatasets, setTotalDatasets] = useState<number>(0);
  const [totalSuites, setTotalSuites] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch stats, recent datasets, and recent suites in parallel
        const [, datasetsResponse, suitesResponse] = await Promise.all([
          apiClient.getStats().catch(() => ({
            total_datasets: 0,
            total_rows: 0,
            total_size_bytes: 0,
            recent_uploads: 0,
          })),
          apiClient.getDatasets({ limit: 3 }).catch(() => ({
            message: 'Error',
            data: {
              datasets: [],
              total: 0,
              page: 1,
              limit: 3,
              total_page: 0,
            },
          })),
          apiClient.getSuites({ limit: 3 }).catch(() => ({
            message: 'Error',
            data: {
              data: [],
              page: 1,
              limit: 3,
              total: 0,
              total_page: 0,
            },
          })),
        ]);

        setRecentDatasets(datasetsResponse.data?.datasets || []);
        setRecentSuites(suitesResponse.data?.data || []);
        setTotalDatasets(datasetsResponse.data?.total || 0);
        setTotalSuites(suitesResponse.data?.total || 0);
      } catch (error) {
        toast.error('Failed to load dashboard data');
        console.error('Dashboard error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);



  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getStatusBadge = (status: string) => {
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
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Welcome back, Evangelist</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, Evangelist</h1>
          <p className="text-muted-foreground">
            Overview of your evaluation management system
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Datasets</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalDatasets)}</div>
            <p className="text-xs text-muted-foreground">
              Active datasets in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suites</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalSuites)}</div>
            <p className="text-xs text-muted-foreground">
              Test suites available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Evaluations completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Running</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Currently running tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Datasets */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {/* <Button variant="outline" className="justify-start" asChild>
                <Link href="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV File
                </Link>
              </Button> */}
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/datasets">
                  <Database className="mr-2 h-4 w-4" />
                  Browse Datasets
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/suites">
                  <TestTube className="mr-2 h-4 w-4" />
                  Browse Suites
                </Link>
              </Button>
              {/* <Button variant="outline" className="justify-start" asChild>
                <Link href="/analytics">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button> */}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Datasets</CardTitle>
            <CardDescription>
              Your most recently created or updated datasets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDatasets.length > 0 ? (
                recentDatasets.map((dataset) => (
                  <div key={dataset.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/datasets/${dataset.id}`}
                        className="font-medium hover:underline"
                      >
                        {dataset.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {dataset.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">
                        {formatNumber(dataset.total_rows || 0)} rows
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateShort(dataset.updated_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No datasets</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by creating your first dataset.
                  </p>
                  <div className="mt-6">
                    <Button asChild>
                      <Link href="/datasets">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Dataset
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Suites and Recent Evaluations */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Suites</CardTitle>
            <CardDescription>
              Your most recently created or updated test suites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSuites.length > 0 ? (
                recentSuites.map((suite) => (
                  <div key={suite.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/suites/${suite.id}`}
                        className="font-medium hover:underline"
                      >
                        {suite.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {suite.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(suite.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateShort(suite.updated_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <TestTube className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No suites</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by creating your first test suite.
                  </p>
                  <div className="mt-6">
                    <Button asChild>
                      <Link href="/suites">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Suite
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Evaluations</CardTitle>
            <CardDescription>
              Your most recently completed evaluations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-6">
                <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No evaluations</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by running your first evaluation.
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link href="/evaluations">
                      <Plus className="mr-2 h-4 w-4" />
                      Run Evaluation
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
