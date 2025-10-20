'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

import {
  Database,
  FileText,
  HardDrive,
  Eye,
  ArrowLeft,
  Server,
  Download,
  BarChart3,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Dataset, DatasetPreview, DatasetHistory } from '@/lib/types';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';

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
import { UploadModal } from '@/components/upload-modal';

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = params.id as string;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [history, setHistory] = useState<DatasetHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const fetchDatasetDetails = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [datasetResponse, , previewResponse, historyResponse] = await Promise.all([
        apiClient.getDataset(datasetId),
        apiClient.getDatasetSchema(datasetId).catch(() => null),
        apiClient.getDatasetPreview(datasetId, 10).catch(() => null),
        apiClient.getDatasetHistory(datasetId).catch(() => null),
      ]);

      setDataset(datasetResponse);
      setPreview(previewResponse);
      setHistory(historyResponse);
    } catch (error) {
      toast.error('Failed to load dataset details');
      console.error('Dataset detail error:', error);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (datasetId) {
      fetchDatasetDetails();
    }
  }, [datasetId, fetchDatasetDetails]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExportDataset = async () => {
    try {
      const minioUrl = (process.env.NEXT_PUBLIC_MINIO_BROWSER_URL || 'http://localhost:9001').replace('/browser', '');
      const downloadUrl = `${minioUrl}/api/v1/buckets/datasets/objects/download?prefix=${encodeURIComponent(datasetId + '/')}`;

      // Open the download URL in a new tab
      window.open(downloadUrl, '_blank');

      toast.success('Dataset export initiated');
    } catch (error) {
      toast.error('Failed to export dataset');
      console.error('Export error:', error);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };





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

  if (!dataset) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold">Dataset not found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The dataset you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push('/datasets')}>
            Back to Datasets
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
          <Button variant="outline" size="sm" onClick={() => router.push('/datasets')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Datasets
          </Button>
        </div>

        {/* Title Row */}
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Database className="mr-3 h-8 w-8" />
            {dataset.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {dataset.description || "No description provided"}
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
            <Button
              className="w-full"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload More Data
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportDataset}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Dataset
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
                      Upload History & Logs
                    </DrawerTitle>
                    <DrawerDescription>
                      Complete history of all uploads for {dataset.name}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 pb-0">
                    {history?.history && history.history.length > 0 ? (
                      <div className="space-y-6">
                        {/* Upload History Table */}
                        <div>
                          <div className="max-h-96 overflow-y-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>File Name</TableHead>
                                  <TableHead>Upload Time</TableHead>
                                  <TableHead className="text-right">Rows Added</TableHead>
                                  <TableHead className="text-right">File Size</TableHead>
                                  <TableHead className="text-right">Cumulative Rows</TableHead>
                                  <TableHead className="text-right">Cumulative Size</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {history.history.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">{item.filename}</TableCell>
                                    <TableCell>{formatDate(item.timestamp)}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant="secondary">+{formatNumber(item.rows_added)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{formatBytes(item.file_size_bytes)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(item.cumulative_rows)}</TableCell>
                                    <TableCell className="text-right">{formatBytes(item.cumulative_file_size_bytes)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-semibold">No upload history</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          No files have been uploaded to this dataset yet.
                        </p>
                      </div>
                    )}
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button variant="outline">Close</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const minioUrl = process.env.NEXT_PUBLIC_MINIO_BROWSER_URL || 'http://localhost:9001';
                const url = `${minioUrl}/datasets/${datasetId}%2F`;
                window.open(url, '_blank');
              }}
            >
              <Server className="mr-2 h-4 w-4" />
              Show in MinIO
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Dataset Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dataset Metadata */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                <p className="text-sm">{formatDate(dataset.created_at)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Last Updated</h4>
                <p className="text-sm">{formatDate(dataset.updated_at)}</p>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{formatNumber(dataset.total_rows || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <HardDrive className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{formatBytes(history?.history?.length ? history.history[history.history.length - 1].cumulative_file_size_bytes : 0)}</div>
                <p className="text-sm text-muted-foreground">Storage Size</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg h-24 flex flex-col justify-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{history?.total_files || 0}</div>
                <p className="text-sm text-muted-foreground">Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Data Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="mr-2 h-5 w-5" />
            Data Preview
          </CardTitle>
          <CardDescription>
            {preview?.data ? (
              `Showing ${preview.data.preview_count} of ${preview.data.total_rows_in_file} rows from ${preview.data.file_name}`
            ) : (
              "Sample rows from your dataset"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview?.data?.rows && preview.data.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.data.columns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.data.rows.map((row, index) => (
                    <TableRow key={index}>
                      {preview.data.columns.map((column) => (
                        <TableCell key={column}>
                          {row[column]?.toString() || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No data available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload data files to see a preview.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        dataset={dataset}
        onUploadComplete={() => {
          // Refresh dataset details after upload
          fetchDatasetDetails();
        }}
      />

    </div>
  );
}