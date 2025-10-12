import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Dataset,
  DatasetSchema,
  DatasetPreview,
  DatasetHistory,
  DatasetStats,
  CreateDatasetRequest,
  UpdateDatasetRequest,
  PaginationParams,
  PaginatedResponse,
  ApiError,
} from './types';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError: ApiError = {
          detail: error.response?.data?.detail || error.message,
          status_code: error.response?.status || 500,
        };
        return Promise.reject(apiError);
      }
    );
  }

  // Dataset CRUD operations
  async getDatasets(params?: PaginationParams): Promise<PaginatedResponse<Dataset>> {
    const response: AxiosResponse<PaginatedResponse<Dataset>> = await this.client.get('/v1/datasets', {
      params,
    });
    return response.data;
  }

  async getDataset(id: string): Promise<Dataset> {
    const response: AxiosResponse<{ message: string, data: Dataset }> = await this.client.get(`/v1/datasets/${id}`);
    return response.data.data;
  }

  async createDataset(data: CreateDatasetRequest): Promise<Dataset> {
    const response: AxiosResponse<Dataset> = await this.client.post('/v1/datasets', data);
    return response.data;
  }

  async updateDataset(id: string, data: UpdateDatasetRequest): Promise<Dataset> {
    const response: AxiosResponse<Dataset> = await this.client.put(`/v1/datasets/${id}`, data);
    return response.data;
  }

  async deleteDataset(id: string): Promise<void> {
    await this.client.delete(`/v1/datasets/${id}`);
  }

  // Dataset schema and preview
  async getDatasetSchema(id: string): Promise<DatasetSchema> {
    const response: AxiosResponse<DatasetSchema> = await this.client.get(`/v1/datasets/${id}/schema`);
    return response.data;
  }

  async getDatasetPreview(id: string, limit: number = 100): Promise<DatasetPreview> {
    const response: AxiosResponse<DatasetPreview> = await this.client.get(`/v1/datasets/${id}/preview`, {
      params: { limit },
    });
    return response.data;
  }

  // Dataset history
  async getDatasetHistory(id: string): Promise<DatasetHistory> {
    const response: AxiosResponse<{ message: string, data: DatasetHistory }> = await this.client.get(`/v1/datasets/${id}/history`);
    return response.data.data;
  }

  // File upload
  async uploadFile(datasetId: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    const formData = new FormData();
    formData.append('csv_file', file);

    await this.client.post(`/v1/datasets/${datasetId}/upload-csv`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }

  // Statistics
  async getStats(): Promise<DatasetStats> {
    const response: AxiosResponse<DatasetStats> = await this.client.get('/v1/datasets/stats/overview');
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response: AxiosResponse<{ status: string }> = await this.client.get('/');
    return response.data;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;