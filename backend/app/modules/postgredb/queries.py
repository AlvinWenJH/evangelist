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
    status VARCHAR(20) DEFAULT 'READY' CHECK (status IN ('READY', 'RUNNING', 'FAILED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_suite_name_not_deleted 
ON evaluation_suites (name) WHERE is_deleted = FALSE;
"""
