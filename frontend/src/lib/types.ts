// API Response Types
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  file_count?: number;
  total_rows?: number;
  total_size_bytes?: number;
  dataset_metadata?: Record<string, unknown>;
  is_deleted?: boolean;
}

export interface DatasetSchema {
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
  }>;
}

export interface DatasetPreview {
  message: string;
  data: {
    rows: Record<string, unknown>[];
    columns: string[];
    preview_count: number;
    total_rows_in_file: number;
    file_name: string;
    limit: number;
  };
}

export interface DatasetHistoryItem {
  timestamp: string;
  filename: string;
  rows_added: number;
  cumulative_rows: number;
  file_size_bytes: number;
  cumulative_file_size_bytes: number;
}

export interface DatasetHistory {
  dataset_id: string;
  history: DatasetHistoryItem[];
  total_files: number;
  cumulative_rows: number;
}

export interface DatasetStats {
  total_datasets: number;
  total_rows: number;
  average_rows_per_dataset: number;
}

// API Request Types
export interface CreateDatasetRequest {
  name: string;
  description?: string;
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
}

export interface UploadFileRequest {
  file: File;
  dataset_id: string;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  keyword?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  message: string;
  data: {
    datasets?: T[];  // For datasets endpoint
    data?: T[];      // For other endpoints that might use different structure
    page: number;
    limit: number;
    total: number;
    total_page: number;
  };
}

// Suite status enum to match backend
export type SuiteStatus = 'READY' | 'RUNNING' | 'FAILED';

// Suite Types
export interface Suite {
  id: string;
  name: string;
  description?: string;
  dataset_id?: string;
  total_evals?: number;
  created_at: string;
  updated_at: string;
  suite_metadata?: Record<string, unknown>;
  is_deleted?: boolean;
  status: SuiteStatus;
}

export interface SuiteStats {
  total_suites: number;
  total_evals: number;
  average_evals_per_suite: string;
  status_counts: {
    ready: number;
    running: number;
    failed: number;
  };
}

// Suite Request Types
export interface CreateSuiteRequest {
  name: string;
  description?: string;
  dataset_id?: string;
  suite_metadata?: Record<string, unknown>;
  status?: SuiteStatus;
}

export interface UpdateSuiteRequest {
  name?: string;
  description?: string;
  dataset_id?: string;
  total_evals?: number;
  suite_metadata?: Record<string, unknown>;
  status?: SuiteStatus;
}

// Workflow Types
export interface WorkflowStep {
  description: string;
  script: string;
  input: Record<string, unknown>;
}

// Enhanced Invocation Types
export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestBodyType = 'none' | 'json' | 'formData';

// New unified input type structure
export interface InputTypeConfig {
  params?: {
    data: KeyValuePair[];
  };
  body?: {
    json?: KeyValuePair[];
    form?: KeyValuePair[];
  };
}

export interface InvocationInput {
  url: string;
  method: string;
  headers?: KeyValuePair[];
  input_type: InputTypeConfig;
}

// Legacy interface for backward compatibility
export interface LegacyInvocationInput {
  url: string;
  method: string;
  params: KeyValuePair[];
  bodyType: RequestBodyType;
  body: {
    json?: KeyValuePair[];
    formData?: KeyValuePair[];
  };
}

export interface InvocationWorkflowStep {
  description: string;
  script: string;
  input: InvocationInput;
}

export interface WorkflowConfig {
  workflow: {
    name: string;
    description: string;
    version: number;
    steps: {
      preprocessing: WorkflowStep;
      invocation: InvocationWorkflowStep;
      postprocessing: WorkflowStep;
      evaluation: WorkflowStep;
    };
  };
  config_files?: Record<string, unknown>;
}

export interface SuiteConfig {
  suite_id: string;
  workflow_config: WorkflowConfig | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorkflowConfigRequest {
  workflow_config: WorkflowConfig;
}

export interface UpdateWorkflowConfigRequest {
  configuration: WorkflowConfig;
}

// Evaluation Types
export interface Evaluation {
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

export interface CreateEvaluationRequest {
  name: string;
  description: string;
  suite_id: string;
  dataset_id: string;
  eval_metadata?: Record<string, any>;
}

export interface EvaluationStats {
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

// API Error Types
export interface ApiError {
  detail: string;
  status_code: number;
}