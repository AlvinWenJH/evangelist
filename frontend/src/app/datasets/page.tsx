'use client';

import { useEffect, useState } from 'react';
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

import {
  Plus,
  Search,
  Database,
  Calendar,
  HardDrive,
  FileText,
  Trash2,
  Eye,
  Upload,
  BarChart3,
  TrendingUp,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Dataset, CreateDatasetRequest } from '@/lib/types';
import { toast } from 'sonner';
import { UploadModal } from '@/components/upload-modal';

interface DatasetStats {
  total_datasets: number;
  total_rows: string;
  average_rows_per_dataset: string;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDatasetForUpload, setSelectedDatasetForUpload] = useState<Dataset | null>(null);
  const [newDataset, setNewDataset] = useState<CreateDatasetRequest>({
    name: '',
    description: '',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);

  // Fetch stats only once on component mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch datasets when search term or page changes
  useEffect(() => {
    fetchDatasets();
  }, [searchTerm, currentPage]);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDatasets({
        keyword: searchTerm || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
      // The API returns datasets in response.data.datasets
      const datasetsArray = response.data?.datasets || [];
      setDatasets(Array.isArray(datasetsArray) ? datasetsArray : []);

      // Update pagination state
      setTotalPages(response.data?.total_page || 1);
      setTotalItems(response.data?.total || 0);
    } catch (error) {
      toast.error('Failed to load datasets');
      console.error('Datasets error:', error);
      // Set empty array on error to prevent filter issues
      setDatasets([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('http://localhost:8000/api/v1/datasets/stats/overview');
      const result = await response.json();
      if (result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dataset stats:', error);
      // Set default values if API fails
      setStats({
        total_datasets: datasets.length,
        total_rows: '0',
        average_rows_per_dataset: '0'
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreateDataset = async () => {
    if (!newDataset.name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      await apiClient.createDataset(newDataset);
      toast.success('Dataset created successfully');
      setIsCreateDialogOpen(false);
      setNewDataset({ name: '', description: '' });
      fetchDatasets();
      fetchStats(); // Refresh stats after creating dataset
    } catch (error) {
      toast.error('Failed to create dataset');
      console.error('Create dataset error:', error);
    }
  };

  const handleDeleteDataset = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.deleteDataset(id);
      toast.success('Dataset deleted successfully');
      fetchDatasets();
      fetchStats(); // Refresh stats after deleting dataset
    } catch (error) {
      toast.error('Failed to delete dataset');
      console.error('Delete dataset error:', error);
    }
  };

  const handleUploadClick = (dataset: Dataset) => {
    setSelectedDatasetForUpload(dataset);
    setIsUploadModalOpen(true);
  };

  const handleUploadComplete = () => {
    fetchDatasets();
    fetchStats(); // Refresh stats after upload
    setIsUploadModalOpen(false);
    setSelectedDatasetForUpload(null);
  };

  const formatNumber = (num: number | string) => {
    const numValue = typeof num === 'string' ? parseInt(num) : num;
    return new Intl.NumberFormat().format(numValue);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Using server-side filtering and pagination, so no need for client-side filtering

  return (
    <div className="container mx-auto py-2 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Datasets</h1>
          <p className="text-muted-foreground">
            Manage your evaluation datasets for evaluation workflows
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Dataset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="space-y-1 pb-1">
              <DialogTitle className="text-xl font-semibold">Create New Dataset</DialogTitle>
              <DialogDescription className="text-base">
                Create a new dataset to organize your data files.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-sm font-medium">
                  Dataset Name
                </Label>
                <Input
                  id="name"
                  value={newDataset.name}
                  onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })}
                  placeholder="Enter dataset name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={newDataset.description}
                  onChange={(e) => setNewDataset({ ...newDataset, description: e.target.value })}
                  placeholder="Enter dataset description"
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
                onClick={handleCreateDataset}
                className="flex-1 sm:flex-none"
              >
                Create Dataset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dataset Analytics */}
      <div className="space-y-6">
        <div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Datasets</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.total_datasets || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active data collections
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : formatNumber(stats?.total_rows || '0')}
                </div>
                <p className="text-xs text-muted-foreground">
                  Records across all datasets
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rows</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : formatNumber(stats?.average_rows_per_dataset || '0')}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mean dataset size
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Datasets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Datasets</CardTitle>
          <CardDescription>
            {totalItems} dataset{totalItems !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading datasets...</p>
            </div>
          ) : datasets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4">Name</TableHead>
                  <TableHead className="w-3/4">Description</TableHead>
                  <TableHead className="w-1/4">Rows</TableHead>
                  <TableHead className="w-1/4">Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell className="font-medium w-1/4">
                      <Link
                        href={`/datasets/${dataset.id}`}
                        className="hover:underline flex items-center"
                      >
                        <Database className="mr-2 h-4 w-4" />
                        {dataset.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground w-3/4">
                      {dataset.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" />
                        {formatNumber(dataset.total_rows || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="mr-1 h-3 w-3" />
                        {new Date(dataset.updated_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUploadClick(dataset)}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/datasets/${dataset.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Database className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No datasets found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating your first dataset.
              </p>
              <Button
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Dataset
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

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
        dataset={selectedDatasetForUpload}
      />
    </div>
  );
}