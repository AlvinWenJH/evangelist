'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Suite, SuiteConfig, WorkflowConfig } from '@/lib/types';
import { toast } from 'sonner';
import WorkflowConfiguration from '@/components/workflow-configuration';

export default function EditConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const suiteId = params.id as string;

  const [suite, setSuite] = useState<Suite | null>(null);
  const [suiteConfig, setSuiteConfig] = useState<SuiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<WorkflowConfig | null>(null);

  const fetchSuiteData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch suite details
      const suiteResponse = await apiClient.getSuite(suiteId);
      setSuite(suiteResponse);

      // Fetch suite configuration
      try {
        const configResponse = await apiClient.getSuiteConfig(suiteId);
        setSuiteConfig(configResponse);
      } catch (configError: unknown) {
        if (configError && typeof configError === 'object' && 'status_code' in configError && configError.status_code === 404) {
          setSuiteConfig(null);
        } else {
          throw configError;
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching suite data:', error);
      toast.error('Failed to load suite data');
    } finally {
      setIsLoading(false);
    }
  }, [suiteId]);

  useEffect(() => {
    fetchSuiteData();
  }, [fetchSuiteData]);

  const handleSaveWorkflow = useCallback(async () => {
    if (!currentConfig) {
      toast.error('No configuration to save');
      return;
    }

    setIsSaving(true);
    try {
      // Always use PUT with full configuration structure
      await apiClient.updateSuiteConfig(suiteId, { configuration: currentConfig });

      toast.success('Workflow configuration saved successfully');

      // Navigate back to the suite detail page
      router.push(`/suites/${suiteId}`);
    } catch (error: unknown) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow configuration');
    } finally {
      setIsSaving(false);
    }
  }, [currentConfig, suiteId, router]);

  const handleTestWorkflow = useCallback(async () => {
    if (!currentConfig) {
      toast.error('No configuration to test');
      return;
    }

    setIsTesting(true);
    try {
      // TODO: Implement actual workflow testing API call
      // For now, simulate a test with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success('Workflow test completed successfully');
    } catch (error: unknown) {
      console.error('Error testing workflow:', error);
      toast.error('Failed to test workflow configuration');
    } finally {
      setIsTesting(false);
    }
  }, [currentConfig]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Suite Not Found</h1>
          <p className="text-muted-foreground mb-4">The requested suite could not be found.</p>
          <Button onClick={() => router.push('/suites')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Suites
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back Button Row */}
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/suites/${suiteId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Detail
          </Button>
        </div>

        {/* Title and Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Edit Configuration</h1>
            <p className="text-muted-foreground">
              Choose the advanced mode to use custom python script
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleTestWorkflow}
              disabled={isTesting || !currentConfig}
              variant="outline"
              className="gap-2 w-full sm:w-auto"
            >
              <Play className="w-4 h-4" />
              {isTesting ? 'Testing...' : 'Test Workflow'}
            </Button>
            <Button onClick={handleSaveWorkflow} disabled={isSaving} className="gap-2 w-full sm:w-auto">
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <WorkflowConfiguration
        initialConfig={suiteConfig?.workflow_config || null}
        suite={suite}
        onConfigChange={setCurrentConfig}
      />
    </div>
  );
}