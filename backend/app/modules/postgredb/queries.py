import os

timezone = os.getenv("TIME_ZONE", "Asia/Jakarta")

QUERY = {}

QUERY["CREATE_DATASETS_TABLE"] = """
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_rows BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dataset_metadata JSONB DEFAULT '{}'::JSONB,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);
"""

QUERY["CREATE_SUITES_TABLE"] = """
CREATE TABLE IF NOT EXISTS evaluation_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    total_evals INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    suite_metadata JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'READY' CHECK (status IN ('READY', 'RUNNING', 'FAILED')),
    current_config_version INTEGER DEFAULT 0 NOT NULL,
    latest_config_version INTEGER DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_suite_name_not_deleted 
ON evaluation_suites (name) WHERE is_deleted = FALSE;
"""

QUERY["CREATE_EVALS_TABLE"] = """
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    suite_id UUID REFERENCES evaluation_suites(id) ON DELETE SET NULL,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    eval_metadata JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    current_config_version INTEGER DEFAULT 0 NOT NULL,
    latest_config_version INTEGER DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_eval_name_not_deleted 
ON evaluations (name) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_evaluations_suite_id ON evaluations (suite_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_dataset_id ON evaluations (dataset_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations (status);
"""
