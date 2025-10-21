'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  Plus,
  Search,
  TestTube,
  Calendar,
  FileText,
  Trash2,
  Eye,
  BarChart3,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Suite, CreateSuiteRequest, Dataset, SuiteStats, SuiteStatus } from '@/lib/types';
import { toast } from 'sonner';
import { formatDateShort } from '@/lib/date-utils';

export default function SuitesPage() {
  const router = useRouter();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<SuiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SuiteStatus | 'ALL'>('ALL');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateEvalDialogOpen, setIsCreateEvalDialogOpen] = useState(false);
  const [selectedSuiteForEval, setSelectedSuiteForEval] = useState<Suite | null>(null);
  const [newSuite, setNewSuite] = useState<CreateSuiteRequest>({
    name: '',
    description: '',
    dataset_id: '',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);

  const fetchSuites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSuites({
        keyword: searchTerm || undefined,
        status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
      // The API returns suites in response.data.data
      const suitesArray = response.data?.data || [];
      setSuites(Array.isArray(suitesArray) ? suitesArray : []);

      // Update pagination state
      setTotalPages(response.data?.total_page || 1);
      setTotalItems(response.data?.total || 0);
    } catch (error) {
      toast.error('Failed to load suites');
      console.error('Suites error:', error);
      // Set empty array on error to prevent filter issues
      setSuites([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, currentPage, itemsPerPage]);

  const fetchDatasets = useCallback(async () => {
    try {
      const response = await apiClient.getDatasets({ limit: 100 }); // Get all datasets for dropdown
      const datasetsArray = response.data?.datasets || [];
      setDatasets(Array.isArray(datasetsArray) ? datasetsArray : []);
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
      setDatasets([]);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await apiClient.getSuiteStats();
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch suite stats:', error);
      // Set default values if API fails
      setStats({
        total_suites: 0,
        total_evals: 0,
        average_evals_per_suite: '0',
        status_counts: {
          ready: 0,
          running: 0,
          failed: 0
        }
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch stats and datasets only once on component mount
  useEffect(() => {
    fetchStats();
    fetchDatasets();
  }, [fetchStats, fetchDatasets]);

  // Fetch suites when search term, status filter, or page changes
  useEffect(() => {
    fetchSuites();
  }, [fetchSuites, searchTerm, statusFilter, currentPage, itemsPerPage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  const handleStatusFilterChange = useCallback((value: SuiteStatus | 'ALL') => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleCreateSuite = useCallback(async () => {
    if (!newSuite.name.trim()) {
      toast.error('Suite name is required');
      return;
    }

    if (!newSuite.dataset_id) {
      toast.error('Please select a dataset');
      return;
    }

    try {
      await apiClient.createSuite(newSuite);
      toast.success('Evaluation suite created successfully');
      setIsCreateDialogOpen(false);
      setNewSuite({ name: '', description: '', dataset_id: '' });
      fetchSuites();
      fetchStats(); // Refresh stats after creating suite
    } catch (error) {
      toast.error('Failed to create evaluation suite');
      console.error('Create suite error:', error);
    }
  }, [newSuite, fetchSuites, fetchStats]);

  const handleDeleteSuite = useCallback(async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.deleteSuite(id);
      toast.success('Evaluation suite deleted successfully');
      fetchSuites();
      fetchStats(); // Refresh stats after deleting suite
    } catch (error) {
      toast.error('Failed to delete evaluation suite');
      console.error('Delete suite error:', error);
    }
  }, [fetchSuites, fetchStats]);

  const handleCreateEvalClick = useCallback((suite: Suite) => {
    setSelectedSuiteForEval(suite);
    setIsCreateEvalDialogOpen(true);
  }, []);

  const handleCreateEval = useCallback(() => {
    // TODO: Implement evaluation creation logic
    toast.success('Evaluation created successfully');
    setIsCreateEvalDialogOpen(false);
    setSelectedSuiteForEval(null);
    fetchSuites(); // Refresh to update eval counts
  }, [fetchSuites]);

  const formatNumber = (num: number | string) => {
    const numValue = typeof num === 'string' ? parseInt(num) : num;
    return new Intl.NumberFormat().format(numValue);
  };

  const getStatusIcon = (status: Suite['status']) => {
    switch (status) {
      case 'READY':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'RUNNING':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: Suite['status']) => {
    switch (status) {
      case 'READY':
        return 'default';
      case 'RUNNING':
        return 'secondary';
      case 'FAILED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-2 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Evaluation Suites</h1>
            <p className="text-muted-foreground">
              Manage your evaluation suites and create evaluations
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Suite
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader className="space-y-1 pb-1">
                <DialogTitle className="text-xl font-semibold">Create New Evaluation Suite</DialogTitle>
                <DialogDescription className="text-base">
                  Create a new evaluation suite to organize your evaluations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Suite Name
                  </Label>
                  <Input
                    id="name"
                    value={newSuite.name}
                    onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                    placeholder="Enter suite name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dataset" className="text-sm font-medium">
                    Dataset
                  </Label>
                  <Select
                    value={newSuite.dataset_id}
                    onValueChange={(value) => setNewSuite({ ...newSuite, dataset_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={newSuite.description}
                    onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                    placeholder="Enter suite description"
                    className="min-h-[80px] resize-none"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSuite}
                  className="flex-1 sm:flex-none"
                >
                  Create Suite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Suite Analytics */}
        <div className="space-y-6">
          <div>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Suites</CardTitle>
                  <TestTube className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.total_suites || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active evaluation suites
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : formatNumber(stats?.total_evals || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Evaluations across all suites
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Evaluations</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : formatNumber(stats?.average_evals_per_suite || '0')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mean evaluations per suite
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Running Suites</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.status_counts?.running || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Currently executing
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Suites Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Evaluation Suites</CardTitle>
            <CardDescription>
              {totalItems} suite{totalItems !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suites..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="READY">Ready</SelectItem>
                    <SelectItem value="RUNNING">Running</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading suites...</p>
              </div>
            ) : suites.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Name</TableHead>
                    <TableHead className="w-2/4">Description</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-24">Evaluations</TableHead>
                    <TableHead className="w-32">Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suites.map((suite) => (
                    <TableRow key={suite.id}>
                      <TableCell className="font-medium w-1/4">
                        <Link
                          href={`/suites/${suite.id}`}
                          className="hover:underline flex items-center"
                        >
                          <TestTube className="mr-2 h-4 w-4" />
                          {suite.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground w-2/4">
                        {suite.description || 'No description'}
                      </TableCell>
                      <TableCell className="w-20">
                        <Badge variant={getStatusBadgeVariant(suite.status)} className="flex items-center gap-1 w-fit">
                          {getStatusIcon(suite.status)}
                          {capitalizeStatus(suite.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-24">
                        <Badge variant="secondary">
                          <FileText className="mr-1 h-3 w-3" />
                          {formatNumber(suite.total_evals || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-32">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="mr-1 h-3 w-3" />
                          {formatDateShort(suite.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCreateEvalClick(suite)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Create evaluation</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/suites/${suite.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View suite details</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSuite(suite.id, suite.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete suite</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <TestTube className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No evaluation suites found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by creating your first evaluation suite.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Suite
                </Button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) handlePageChange(currentPage - 1);
                        }}
                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(pageNum);
                            }}
                            isActive={currentPage === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) handlePageChange(currentPage + 1);
                        }}
                        className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Evaluation Modal */}
        <Dialog open={isCreateEvalDialogOpen} onOpenChange={setIsCreateEvalDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="space-y-1 pb-1">
              <DialogTitle className="text-xl font-semibold">Create Evaluation</DialogTitle>
              <DialogDescription className="text-base">
                Create a new evaluation for &quot;{selectedSuiteForEval?.name}&quot;
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This will create a new evaluation run for the selected suite.
                  The evaluation will use the configured dataset and run according to the suite settings.
                </p>
              </div>
            </div>
            <DialogFooter className="pt-4 gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCreateEvalDialogOpen(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateEval}
                className="flex-1 sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Evaluation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}