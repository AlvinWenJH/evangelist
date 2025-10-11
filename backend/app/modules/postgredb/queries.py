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
