'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Database,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api';
import { Dataset } from '@/lib/types';
import { toast } from 'sonner';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  errorDetails?: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset | null;
  onUploadComplete?: () => void;
}

export function UploadModal({ isOpen, onClose, dataset, onUploadComplete }: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFiles = acceptedFiles.filter(file =>
      file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
    );

    if (csvFiles.length !== acceptedFiles.length) {
      toast.error('Only CSV files are supported');
    }

    if (csvFiles.length === 0) {
      return;
    }

    const newFiles: UploadFile[] = csvFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending'
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: true,
    disabled: isUploading
  });

  const removeFile = (fileId: string) => {
    if (isUploading) return;
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const retryFile = (fileId: string) => {
    if (isUploading) return;
    setUploadFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, status: 'pending', error: undefined, errorDetails: undefined, progress: 0 }
        : f
    ));
  };

  const uploadFile = async (uploadFile: UploadFile, datasetId: string) => {
    try {
      setUploadFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      await apiClient.uploadFile(datasetId, uploadFile.file, (progress) => {
        setUploadFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, progress }
            : f
        ));
      });

      setUploadFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));

      return true;
    } catch (error: unknown) {
      // Extract detailed error message from API response
      let errorMessage = 'Upload failed';
      let errorDetails = '';

      if (error && typeof error === 'object' && 'detail' in error) {
        const errorDetail = (error as { detail: string }).detail;
        errorMessage = errorDetail;
        // For schema validation errors, extract the specific issue
        if (errorDetail.includes('Schema validation failed:')) {
          const match = errorDetail.match(/Schema validation failed: (.+)/);
          if (match) {
            errorDetails = match[1];
            errorMessage = 'Schema validation failed';
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setUploadFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', error: errorMessage, errorDetails }
          : f
      ));
      return false;
    }
  };

  const handleUpload = async () => {
    if (!dataset || uploadFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    try {
      setIsUploading(true);

      // Upload files sequentially
      let successCount = 0;
      for (const file of pendingFiles) {
        const success = await uploadFile(file, dataset.id);
        if (success) successCount++;
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file(s) to ${dataset.name}`);
        onUploadComplete?.();
        // Auto-close modal after successful upload
        handleClose();
      } else {
        toast.error('Failed to upload any files');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) {
      toast.error('Cannot close while uploading');
      return;
    }
    setUploadFiles([]);
    setIsUploading(false);
    onClose();
  };

  const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
  const canUpload = pendingFiles.length > 0 && !isUploading && dataset;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload Files to {dataset?.name}
          </DialogTitle>
          <DialogDescription>
            Upload CSV files to add more data to this dataset
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dataset Info */}
          {dataset && (
            <div className="flex items-center p-3 bg-muted rounded-lg">
              <Database className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{dataset.name}</p>
                <p className="text-sm text-muted-foreground">
                  {dataset.description || 'No description'}
                </p>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
              ? 'border-primary bg-primary/5'
              : isUploading
                ? 'border-muted-foreground/25 bg-muted/50 cursor-not-allowed'
                : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
          >
            <input {...getInputProps()} />
            <Upload className={`mx-auto h-12 w-12 mb-4 ${isUploading ? 'text-muted-foreground/50' : 'text-muted-foreground'
              }`} />
            {isDragActive ? (
              <p className="text-lg">Drop the CSV files here...</p>
            ) : isUploading ? (
              <div>
                <p className="text-lg mb-2 text-muted-foreground">Upload in progress...</p>
                <p className="text-sm text-muted-foreground">
                  Please wait while files are being uploaded
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg mb-2">Drag & drop CSV files here</p>
                <p className="text-sm text-muted-foreground">
                  or click to select files • Only CSV files are supported
                </p>
              </div>
            )}
          </div>

          {/* Selected Files */}
          {uploadFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Files ({uploadFiles.length})</h4>
                <div className="flex items-center space-x-2">
                  {!isUploading && uploadFiles.some(f => f.status === 'error') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFiles(prev => prev.filter(f => f.status !== 'error'))}
                    >
                      Clear failed
                    </Button>
                  )}
                  {!isUploading && pendingFiles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFiles([])}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {uploadFiles.map((uploadFile) => (
                  <div key={uploadFile.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.file.size)}
                      </p>

                      {uploadFile.status === 'uploading' && (
                        <div className="mt-2 space-y-1">
                          <Progress value={uploadFile.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {uploadFile.progress}% uploaded
                          </p>
                        </div>
                      )}

                      {uploadFile.status === 'error' && (
                        <Alert className="mt-2" variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{uploadFile.error}</p>
                              {uploadFile.errorDetails && (
                                <p>{uploadFile.errorDetails}</p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {uploadFile.status === 'success' && (
                        <CheckCircle className="h-5 w-5" />
                      )}
                      {uploadFile.status === 'error' && (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-5 w-5" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryFile(uploadFile.id)}
                            className="h-8 w-8 p-0"
                            disabled={isUploading}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(uploadFile.id)}
                            className="h-8 w-8 p-0"
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      )}
                      {uploadFile.status === 'pending' && !isUploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!canUpload}
            className="min-w-32"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${pendingFiles.length} File${pendingFiles.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}