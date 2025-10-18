import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Dataset,
  DatasetSchema,
  DatasetPreview,
  DatasetHistory,
  DatasetStats,
  CreateDatasetRequest,
  UpdateDatasetRequest,
  Suite,
  SuiteStats,
  CreateSuiteRequest,
  UpdateSuiteRequest,
  PaginationParams,
  PaginatedResponse,
  ApiError,
  SuiteConfig,
  WorkflowConfig,
  WorkflowStep,
  CreateWorkflowConfigRequest,
  UpdateWorkflowConfigRequest,
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

  // Suite CRUD operations
  async getSuites(params?: PaginationParams & { keyword?: string; status?: string }): Promise<PaginatedResponse<Suite>> {
    const response: AxiosResponse<{ message: string, data: { suites: Suite[], page: number, limit: number, total: number, total_page: number } }> = await this.client.get('/v1/suites', {
      params,
    });
    // Transform backend response to match expected PaginatedResponse format
    const backendData = response.data.data;
    return {
      message: response.data.message,
      data: {
        data: backendData.suites || [],
        page: backendData.page || 1,
        limit: backendData.limit || 10,
        total: backendData.total || 0,
        total_page: backendData.total_page || 1,
      }
    };
  }

  async getSuite(id: string): Promise<Suite> {
    const response: AxiosResponse<{ message: string, data: Suite }> = await this.client.get(`/v1/suites/${id}`);
    return response.data.data;
  }

  async createSuite(data: CreateSuiteRequest): Promise<Suite> {
    const response: AxiosResponse<{ message: string, data: Suite }> = await this.client.post('/v1/suites', data);
    return response.data.data;
  }

  async updateSuite(id: string, data: UpdateSuiteRequest): Promise<Suite> {
    const response: AxiosResponse<{ message: string, data: Suite }> = await this.client.put(`/v1/suites/${id}`, data);
    return response.data.data;
  }

  async deleteSuite(id: string): Promise<void> {
    await this.client.delete(`/v1/suites/${id}`);
  }

  // Suite statistics
  async getSuiteStats(): Promise<SuiteStats> {
    const response: AxiosResponse<{ message: string, data: SuiteStats }> = await this.client.get('/v1/suites/stats/overview');
    return response.data.data;
  }

  // Suite configuration
  async getSuiteConfig(suiteId: string): Promise<SuiteConfig> {
    const response: AxiosResponse<{ message: string, data: SuiteConfig }> = await this.client.get(`/v1/suites/${suiteId}/config`);
    return response.data.data;
  }

  async createSuiteConfig(suiteId: string, data: CreateWorkflowConfigRequest): Promise<SuiteConfig> {
    const response: AxiosResponse<{ message: string, data: SuiteConfig }> = await this.client.post(`/v1/suites/${suiteId}/config`, data);
    return response.data.data;
  }

  async updateSuiteConfig(suiteId: string, data: UpdateWorkflowConfigRequest): Promise<SuiteConfig> {
    const response: AxiosResponse<{ message: string, data: SuiteConfig }> = await this.client.put(`/v1/suites/${suiteId}/config`, data);
    return response.data.data;
  }

  async deleteSuiteConfig(suiteId: string): Promise<void> {
    await this.client.delete(`/v1/suites/${suiteId}/config`);
  }

  // Individual step configurations
  async getPreprocessingStep(suiteId: string): Promise<WorkflowStep> {
    const response: AxiosResponse<{ message: string, data: WorkflowStep }> = await this.client.get(`/v1/suites/${suiteId}/preprocessing_step`);
    return response.data.data;
  }

  async getInvocationStep(suiteId: string): Promise<WorkflowStep> {
    const response: AxiosResponse<{ message: string, data: WorkflowStep }> = await this.client.get(`/v1/suites/${suiteId}/invocation_step`);
    return response.data.data;
  }

  async getPostprocessingStep(suiteId: string): Promise<WorkflowStep> {
    const response: AxiosResponse<{ message: string, data: WorkflowStep }> = await this.client.get(`/v1/suites/${suiteId}/postprocessing_step`);
    return response.data.data;
  }

  async getEvaluationStep(suiteId: string): Promise<WorkflowStep> {
    const response: AxiosResponse<{ message: string, data: WorkflowStep }> = await this.client.get(`/v1/suites/${suiteId}/evaluation_step`);
    return response.data.data;
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