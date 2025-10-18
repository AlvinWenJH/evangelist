'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Workflow, Plus } from 'lucide-react';

interface WorkflowEmptyStateProps {
  onCreateWorkflow: () => void;
}

export default function WorkflowEmptyState({ onCreateWorkflow }: WorkflowEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center space-y-6">
        {/* Main Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Workflow className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            No Workflow Configured
          </h3>
          <p className="text-gray-600 max-w-sm mx-auto">
            Create a workflow to define your evaluation pipeline.
          </p>
        </div>

        {/* Create Button */}
        <Button 
          onClick={onCreateWorkflow}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </Button>
      </div>
    </div>
  );
}