'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, Loader2, AlertCircle } from 'lucide-react';
import { DatasetPreview } from '@/lib/types';
import { apiClient } from '@/lib/api';

interface DatasetPreviewProps {
  datasetId: string;
  limit?: number;
}

export default function DatasetPreviewComponent({ datasetId, limit = 3 }: DatasetPreviewProps) {
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!datasetId) {
        setError('No dataset ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getDatasetPreview(datasetId, limit);
        setPreview(data);
      } catch (err) {
        console.error('Error fetching dataset preview:', err);
        setError('Failed to load dataset preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [datasetId, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-red-500">
        <AlertCircle className="w-6 h-6" />
        <span className="ml-2">{error}</span>
      </div>
    );
  }

  if (!preview || !preview.data || preview.data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Database className="w-6 h-6" />
        <span className="ml-2">No data to preview</span>
      </div>
    );
  }

  const { data } = preview;
  const { rows, columns, total_rows_in_file, file_name } = data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {rows.length} of {total_rows_in_file} rows from {file_name}</span>
        <Badge variant="secondary">{columns.length} columns</Badge>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="font-medium">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column} className="max-w-xs truncate">
                    {row[column] !== null && row[column] !== undefined
                      ? String(row[column])
                      : <span className="text-muted-foreground italic">null</span>
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total_rows_in_file > rows.length && (
        <p className="text-sm text-muted-foreground">
          ... and more rows
        </p>
      )}
    </div>
  );
}