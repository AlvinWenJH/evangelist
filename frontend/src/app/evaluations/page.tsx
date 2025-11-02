'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { toast } from 'sonner';
import { 
  Search, 
  Eye, 
  Play, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  BarChart3,
  TrendingUp,
  Activity,
  Plus
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

interface EvaluationStats {
  total_evaluations: number;
  evaluations_by_status: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  total_requests: number;
  avg_success_rate: number;
}

interface Suite {
  id: string;
  name: string;
  description: string;
  status: string;
}

export default function EvaluationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSuite, setSelectedSuite] = useState<string>('all');
  const [suitePopoverOpen, setSuitePopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvaluations, setTotalEvaluations] = useState(0);
  const itemsPerPage = 10;

  const fetchSuites = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/suites?limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch suites');
      }
      const data = await response.json();
      setSuites(data.data?.suites || []);
    } catch (error) {
      console.error('Error fetching suites:', error);
      setSuites([]);
    }
  }, []);

  const fetchEvaluations = useCallback(async (page = 1, keyword = '', suiteId = '') => {
    try {
      setLoading(true);
      
      let response;
      if (suiteId && suiteId !== 'all') {
        // Use suite-specific endpoint
        response = await fetch(`http://localhost:8000/api/v1/evals/suite/${suiteId}`);
      } else {
        // Use general endpoint with filters
        const params = new URLSearchParams({
          page: page.toString(),
          limit: itemsPerPage.toString(),
          ...(keyword && { keyword })
        });
        response = await fetch(`http://localhost:8000/api/v1/evals/?${params}`);
      }

      if (!response.ok) {
        throw new Error('Failed to fetch evaluations');
      }

      const data = await response.json();
      
      if (suiteId && suiteId !== 'all') {
        // Suite-specific endpoint returns all evaluations without pagination
        const evaluations = data.data.evaluations || [];
        setEvaluations(evaluations);
        setTotalPages(1);
        setTotalEvaluations(evaluations.length);
      } else {
        // General endpoint with pagination
        setEvaluations(data.data.evals || []);
        setTotalPages(data.data.total_page || 1);
        setTotalEvaluations(data.data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast.error('Failed to fetch evaluations');
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('http://localhost:8000/api/v1/evals/stats/overview');
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation statistics');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Error fetching evaluation statistics:', error);
      toast.error('Failed to fetch evaluation statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get suite_id from URL parameters for filtering
    const suiteIdFromUrl = searchParams.get('suite_id');
    if (suiteIdFromUrl) {
      setSelectedSuite(suiteIdFromUrl);
    }
    
    fetchSuites();
    fetchEvaluations(currentPage, searchTerm, selectedSuite === 'all' ? '' : selectedSuite);
    fetchStats();
  }, [fetchSuites, fetchEvaluations, fetchStats, currentPage, searchTerm, selectedSuite, searchParams]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  const handleSuiteChange = useCallback((suiteId: string) => {
    setSelectedSuite(suiteId);
    setCurrentPage(1);
    setSuitePopoverOpen(false);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const formatNumber = (num: number | string) => {
    const numValue = typeof num === 'string' ? parseInt(num) : num;
    return new Intl.NumberFormat().format(numValue);
  };

  const getStatusIcon = (status: Evaluation['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
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
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateSuccessRate = (successful: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-2 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Evaluations</h1>
            <p className="text-muted-foreground">
              Monitor and manage your evaluation runs
            </p>
          </div>
          <Button onClick={() => router.push('/suites')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Evaluation
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : formatNumber(stats?.total_evaluations || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                All evaluation runs
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
                {statsLoading ? '...' : `${Math.round(stats?.avg_success_rate || 0)}%`}
              </div>
              <p className="text-xs text-muted-foreground">
                Average across all evaluations
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : formatNumber(stats?.total_requests || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Requests processed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : formatNumber(stats?.evaluations_by_status?.running || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Evaluations Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Evaluations ({formatNumber(totalEvaluations)})</CardTitle>
            <CardDescription>
              Manage and monitor your evaluation runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              {/* Suite Selector - Now First */}
              <Popover open={suitePopoverOpen} onOpenChange={setSuitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={suitePopoverOpen}
                    className="w-[200px] justify-between"
                  >
                    {selectedSuite === 'all' 
                      ? "All Suites"
                      : suites.find((suite) => suite.id === selectedSuite)?.name || "All Suites"
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search suites..." />
                    <CommandList>
                      <CommandEmpty>No suite found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => handleSuiteChange('all')}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedSuite === 'all' ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          All Suites
                        </CommandItem>
                        {suites.map((suite) => (
                          <CommandItem
                            key={suite.id}
                            value={suite.name}
                            onSelect={() => handleSuiteChange(suite.id)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedSuite === suite.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {suite.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {/* Search Bar - Now Second */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search evaluations..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading evaluations...</p>
              </div>
            ) : evaluations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{evaluation.name}</div>
                          {evaluation.description && (
                            <div className="text-sm text-muted-foreground">
                              {evaluation.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(evaluation.status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatNumber(evaluation.total_requests)} total</div>
                          <div className="text-muted-foreground">
                            {formatNumber(evaluation.successful_requests)} success, {formatNumber(evaluation.failed_requests)} failed
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {calculateSuccessRate(evaluation.successful_requests, evaluation.total_requests)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(evaluation.started_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(evaluation.completed_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => router.push(`/evaluations/${evaluation.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View evaluation details</p>
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
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No evaluations found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first evaluation.'}
                </p>
                {!searchTerm && (
                  <Button 
                    className="mt-4" 
                    onClick={() => router.push('/suites')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Evaluation
                  </Button>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-4">
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

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
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
      </div>
    </TooltipProvider>
  );
}