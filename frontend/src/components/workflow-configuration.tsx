'use client';

import React, { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database,
  Settings,
  Send,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowConfig, Suite, InvocationInput } from '@/lib/types';
import DatasetPreviewComponent from './dataset-preview';
import { formatDate } from '@/lib/date-utils';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { apiClient } from '@/lib/api';
import InvocationConfig from './invocation-config';
import { JsonPathSelector } from '@/components/ui/json-path-selector';
import { MetricsSelector } from '@/components/ui/metrics-selector';
import TestResultsDisplay from './test-results-display';

interface WorkflowConfigurationProps {
  initialConfig?: WorkflowConfig | null;
  suite?: Suite | null;
  onConfigChange?: (config: WorkflowConfig) => void;
}

export interface WorkflowConfigurationRef {
  testAllSteps: () => Promise<void>;
}

// Custom node component for vertical workflow steps
interface WorkflowStepNodeData {
  label: string;
  stepName: string;
  stepType: string;
  stepData?: {
    description?: string;
    script?: string;
    input?: Record<string, unknown>;
  };
  isTested?: boolean;
}

const VerticalWorkflowStepNode = ({ data }: { data: WorkflowStepNodeData }) => {
  const getStepIcon = (stepName: string) => {
    switch (stepName) {
      case 'database':
        return <Database className="w-6 h-6" />;
      case 'preprocessing':
        return <Settings className="w-3 h-3" />;
      case 'invocation':
        return <Send className="w-3 h-3" />;
      case 'postprocessing':
        return <Settings className="w-3 h-3" />;
      case 'evaluation':
        return <BarChart3 className="w-3 h-3" />;
      default:
        return <Settings className="w-3 h-3" />;
    }
  };

  const getStepColor = (stepName: string) => {
    switch (stepName) {
      case 'database':
        return 'border-cyan-200 bg-cyan-50';
      case 'preprocessing':
        return 'border-blue-200 bg-blue-50';
      case 'invocation':
        return 'border-green-200 bg-green-50';
      case 'postprocessing':
        return 'border-purple-200 bg-purple-50';
      case 'evaluation':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  // Special rendering for database node
  if (data.stepType === 'database') {
    return (
      <div>
        <Card className={`w-16 h-16 ${getStepColor(data.stepType)}`}>
          <CardContent className="p-0 h-full flex items-center justify-center">
            {getStepIcon(data.stepType)}
          </CardContent>
        </Card>

        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          style={{
            background: '#e2e8f0',
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1px solid #cbd5e1'
          }}
        />
      </div>
    );
  }

  // Default rendering for other nodes
  return (
    <div>
      {data.stepType !== 'database' && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          style={{
            background: '#e2e8f0',
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1px solid #cbd5e1'
          }}
        />
      )}

      <Card className={`w-36 ${getStepColor(data.stepType)} relative`}>
        <CardContent className="p-1.5">
          <div className="flex items-center gap-1.5">
            {getStepIcon(data.stepType)}
            <h3 className="text-xs font-medium capitalize">
              {data.stepType}
            </h3>
            {data.isTested && (
              <CheckCircle className="w-3 h-3 text-green-600 ml-auto" />
            )}
          </div>
          {data.stepData && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate leading-tight">
              {data.stepData.description}
            </p>
          )}
        </CardContent>
      </Card>

      {data.stepType !== 'evaluation' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          style={{
            background: '#e2e8f0',
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1px solid #cbd5e1'
          }}
        />
      )}
    </div>
  );
};

const nodeTypes = {
  verticalWorkflowStep: VerticalWorkflowStepNode,
};

const WorkflowConfiguration = forwardRef<WorkflowConfigurationRef, WorkflowConfigurationProps>(({
  initialConfig,
  suite,
  onConfigChange
}, ref) => {
  const [config, setConfig] = useState<WorkflowConfig>(() => {
    if (initialConfig) {
      return initialConfig;
    }

    // Default configuration based on template
    return {
      workflow: {
        name: suite?.name || "New Workflow",
        description: suite?.description || "Evaluation workflow",
        version: 0,
        steps: {
          preprocessing: {
            description: "Preprocess data",
            script: "preprocessing-script.py",
            input: {
              input_columns: [],
              groundtruth_column: ""
            }
          },
          invocation: {
            description: "Request invocation",
            script: "request-invocation-script.py",
            input: {
              url: process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000/api",
              method: "POST",
              headers: [],
              input_type: {}
            }
          },
          postprocessing: {
            description: "Postprocess data",
            script: "postprocessing-script.py",
            input: {
              field: "message"
            }
          },
          evaluation: {
            description: "Evaluation",
            script: "evaluation-script.py",
            input: {
              metrics: ["similarity"]
            }
          }
        }
      }
    };
  });

  const [isFlowCollapsed, setIsFlowCollapsed] = useState(false);
  const [openAccordionValue, setOpenAccordionValue] = useState<string>("database");
  const [datasetColumns, setDatasetColumns] = useState<MultiSelectOption[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  
  // Test state management
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string | null>>({});
  
  // Tab state management for diagram/test results
  const [activeTab, setActiveTab] = useState<'diagram' | 'results'>('diagram');
  const [currentTestResult, setCurrentTestResult] = useState<{
    stepType: string;
    result: any;
    error?: string | null;
  } | null>(null);
  
  // Tested steps tracking
  const [testedSteps, setTestedSteps] = useState<Set<string>>(new Set());

  // Auto-collapse on smaller screens for responsive design
  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth < 1024;
      setIsFlowCollapsed(shouldCollapse);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch dataset columns for multiselect
  const fetchDatasetColumns = useCallback(async () => {
    if (!suite?.dataset_id) return;

    setLoadingColumns(true);
    try {
      const preview = await apiClient.getDatasetPreview(suite.dataset_id, 5);
      if (preview.data?.columns) {
        const columnOptions: MultiSelectOption[] = preview.data.columns.map((column: string) => ({
          value: column,
          label: column
        }));
        setDatasetColumns(columnOptions);
      }
    } catch (error) {
      console.error('Failed to fetch dataset columns:', error);
      toast.error('Failed to load dataset columns');
    } finally {
      setLoadingColumns(false);
    }
  }, [suite?.dataset_id]);

  // Fetch columns when component mounts or dataset changes
  useEffect(() => {
    fetchDatasetColumns();
  }, [fetchDatasetColumns]);

  // Create vertical nodes and edges for the workflow steps
  const { initialNodes, initialEdges } = useMemo(() => {
    const stepNames = ['database', 'preprocessing', 'invocation', 'postprocessing', 'evaluation'];

    let cumulativeY = 20;
    const firstGap = 35;
    const regularGap = 80;
    const databaseHeight = 64;
    const regularNodeHeight = 48;

    const nodes: Node[] = stepNames.map((stepName) => {
      const xPosition = stepName === 'database' ? 50 : 10;
      const yPosition = cumulativeY;

      if (stepName === 'database') {
        cumulativeY += databaseHeight + firstGap;
      } else {
        cumulativeY += regularNodeHeight + regularGap;
      }

      return {
        id: stepName,
        type: 'verticalWorkflowStep',
        position: { x: xPosition, y: yPosition },
        data: {
          label: stepName.charAt(0).toUpperCase() + stepName.slice(1),
          stepName: stepName,
          stepType: stepName,
          stepData: config?.workflow.steps[stepName as keyof typeof config.workflow.steps] || null,
          isTested: testedSteps.has(stepName),
        },
      };
    });

    const edges: Edge[] = [
      {
        id: 'database-preprocessing',
        source: 'database',
        target: 'preprocessing',
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'straight',
        style: { stroke: '#e2e8f0', strokeWidth: 1.5 },
      },
      {
        id: 'preprocessing-invocation',
        source: 'preprocessing',
        target: 'invocation',
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'straight',
        style: { stroke: '#e2e8f0', strokeWidth: 1.5 },
      },
      {
        id: 'invocation-postprocessing',
        source: 'invocation',
        target: 'postprocessing',
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'straight',
        style: { stroke: '#e2e8f0', strokeWidth: 1.5 },
      },
      {
        id: 'postprocessing-evaluation',
        source: 'postprocessing',
        target: 'evaluation',
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'straight',
        style: { stroke: '#e2e8f0', strokeWidth: 1.5 },
      },
    ];

    return { initialNodes: nodes, initialEdges: edges };
  }, [config, testedSteps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when config or tested steps change
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          stepData: config?.workflow.steps[node.id as keyof typeof config.workflow.steps] || null,
          isTested: testedSteps.has(node.id),
        },
      }))
    );
  }, [config, testedSteps, setNodes]);

  // Notify parent component when config changes
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const updateStepInput = useCallback((stepName: string, inputField: string, value: unknown) => {
    setConfig(prev => {
      const currentStep = prev.workflow.steps[stepName as keyof typeof prev.workflow.steps];
      
      if (stepName === 'invocation') {
        const invocationStep = currentStep as typeof prev.workflow.steps.invocation;
        const currentInput = invocationStep?.input || {} as InvocationInput;
        
        return {
          ...prev,
          workflow: {
            ...prev.workflow,
            steps: {
              ...prev.workflow.steps,
              invocation: {
                description: invocationStep?.description || "",
                script: invocationStep?.script || "",
                input: {
                  ...currentInput,
                  [inputField]: value
                }
              }
            }
          }
        };
      }
      
      const regularStep = currentStep as Exclude<typeof currentStep, typeof prev.workflow.steps.invocation>;
      const currentInput = regularStep?.input || {};

      return {
        ...prev,
        workflow: {
          ...prev.workflow,
          steps: {
            ...prev.workflow.steps,
            [stepName]: {
              description: regularStep?.description || "",
              script: regularStep?.script || "",
              input: {
                ...currentInput,
                [inputField]: value
              }
            }
          }
        }
      };
    });
  }, []);

  const updateInputColumns = useCallback((selectedColumns: string[]) => {
    updateStepInput('preprocessing', 'input_columns', selectedColumns);
  }, [updateStepInput]);

  // Test function for each step
  const handleTestStep = useCallback(async (step: 'preprocessing' | 'invocation' | 'postprocessing' | 'evaluation') => {
    if (!suite?.id) {
      toast.error('No suite selected for testing');
      return;
    }

    setTestLoading(prev => ({ ...prev, [step]: true }));
    setTestErrors(prev => ({ ...prev, [step]: null }));

    try {
      const result = await apiClient.testSuiteStep(suite.id, step);
      setTestResults(prev => ({ ...prev, [step]: result }));
      
      setCurrentTestResult({
        stepType: step,
        result: result,
        error: null
      });
      
      setTestedSteps(prev => new Set([...prev, step]));
      setActiveTab("results");
      
      toast.success(`${step.charAt(0).toUpperCase() + step.slice(1)} test completed successfully`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Test failed';
      setTestErrors(prev => ({ ...prev, [step]: errorMessage }));
      
      setCurrentTestResult({
        stepType: step,
        result: null,
        error: errorMessage
      });
      
      setActiveTab("results");
      toast.error(`${step.charAt(0).toUpperCase() + step.slice(1)} test failed: ${errorMessage}`);
    } finally {
      setTestLoading(prev => ({ ...prev, [step]: false }));
    }
  }, [suite?.id]);

  // Test all steps function
  const testAllSteps = useCallback(async () => {
    if (!suite?.id) {
      toast.error('No suite selected for testing');
      return;
    }

    const steps: ('preprocessing' | 'invocation' | 'postprocessing' | 'evaluation')[] = [
      'preprocessing', 
      'invocation', 
      'postprocessing', 
      'evaluation'
    ];

    toast.info('Starting workflow test...');

    for (const step of steps) {
      toast.info(`Testing ${step} step...`);
      
      try {
        await handleTestStep(step);
      } catch (error: any) {
        throw error;
      }
    }

    toast.success('All workflow tests completed successfully');
  }, [suite?.id, handleTestStep]);

  // Expose testAllSteps to parent component
  useImperativeHandle(ref, () => ({
    testAllSteps
  }), [testAllSteps]);

  const getStepIcon = (stepName: string) => {
    switch (stepName) {
      case 'database':
        return <Database className="w-5 h-5" />;
      case 'preprocessing':
        return <Settings className="w-5 h-5" />;
      case 'invocation':
        return <Send className="w-5 h-5" />;
      case 'postprocessing':
        return <Settings className="w-5 h-5" />;
      case 'evaluation':
        return <BarChart3 className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              Workflow Diagram & Configuration
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Version</span>
                <Badge variant="secondary" className="font-mono text-xs">v{config.workflow.version}</Badge>
              </div>
              {suite?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDate(suite.updated_at)}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <div className="flex h-full">
            {!isFlowCollapsed && (
              <>
                <div className="w-2/5 min-h-0 flex flex-col">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'diagram' | 'results')} className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="diagram">Workflow Diagram</TabsTrigger>
                      <TabsTrigger value="results" disabled={!currentTestResult}>
                        Test Results
                        {currentTestResult && (
                          <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                            {currentTestResult.stepType}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="diagram" className="flex-1 mt-2">
                      <div className="h-full min-h-[500px]">
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                          onNodeClick={(event, node) => {
                            setOpenAccordionValue(node.id);
                          }}
                          nodeTypes={nodeTypes}
                          defaultEdgeOptions={{
                            type: 'straight',
                            style: { strokeWidth: 2, stroke: '#e2e8f0' }
                          }}
                          fitView
                          fitViewOptions={{
                            padding: 0.05,
                            maxZoom: 1.0,
                            minZoom: 0.3
                          }}
                          defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
                          attributionPosition="bottom-left"
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={true}
                          panOnDrag={false}
                          zoomOnScroll={false}
                          zoomOnPinch={false}
                          zoomOnDoubleClick={false}
                          style={{ width: '100%', height: '100%' }}
                        >
                          <Controls showInteractive={false} />
                          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                        </ReactFlow>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="results" className="flex-1 mt-2">
                      <div className="h-full min-h-[500px] p-4">
                        {currentTestResult ? (
                          <>
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold">
                                {currentTestResult.stepType.charAt(0).toUpperCase() + currentTestResult.stepType.slice(1)} Test Results
                              </h3>
                            </div>
                            <div className="h-full overflow-y-auto">
                              <TestResultsDisplay
                                result={currentTestResult.result}
                                isLoading={false}
                                error={currentTestResult.error ?? null}
                                step={currentTestResult.stepType}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>No test results available. Run a test to see results here.</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
                <Separator orientation="vertical" className="h-full" />
              </>
            )}

            <div className="flex items-start pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFlowCollapsed(!isFlowCollapsed)}
                className="h-8 w-8 p-0"
              >
                {isFlowCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>

            <div className={`${isFlowCollapsed ? 'w-full' : 'w-3/5'} p-6 overflow-y-auto space-y-6 min-h-0 flex flex-col`}>
              <div className="flex-1 min-h-0">
                <Accordion type="single" collapsible value={openAccordionValue} onValueChange={setOpenAccordionValue} className="space-y-4">
                  {/* Database Step */}
                  <AccordionItem value="database">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('database')}
                        <span className="font-medium">Database</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      {suite?.dataset_id ? (
                        <DatasetPreviewComponent datasetId={suite.dataset_id} limit={3} />
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Database className="w-8 h-8 mx-auto mb-2" />
                          <p>No dataset associated with this suite</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Preprocessing Step */}
                  <AccordionItem value="preprocessing">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('preprocessing')}
                        <span className="font-medium">Preprocessing</span>
                        {testedSteps.has('preprocessing') && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Data Configuration</CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestStep('preprocessing')}
                              disabled={testLoading.preprocessing}
                            >
                              {testLoading.preprocessing ? 'Testing...' : 'Test'}
                            </Button>
                          </div>
                          <CardDescription>
                            Configure input columns and ground truth for your dataset
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-3">
                            <Label>Input Columns</Label>
                            <MultiSelect
                              options={datasetColumns}
                              selected={config.workflow.steps.preprocessing.input.input_columns as string[]}
                              onChange={updateInputColumns}
                              placeholder={loadingColumns ? "Loading columns..." : "Select input columns"}
                              disabled={loadingColumns || datasetColumns.length === 0}
                            />
                            {datasetColumns.length === 0 && !loadingColumns && (
                              <p className="text-sm text-muted-foreground">
                                No dataset columns available. Please ensure a dataset is selected.
                              </p>
                            )}
                          </div>
                          <div className="space-y-3">
                            <Label htmlFor="groundtruth-column">Ground Truth Column</Label>
                            <Select
                              value={config.workflow.steps.preprocessing.input.groundtruth_column as string}
                              onValueChange={(value) => updateStepInput('preprocessing', 'groundtruth_column', value)}
                              disabled={loadingColumns || datasetColumns.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={loadingColumns ? "Loading columns..." : "Select ground truth column"} />
                              </SelectTrigger>
                              <SelectContent>
                                {datasetColumns.map((column) => (
                                  <SelectItem key={column.value} value={column.value}>
                                    {column.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {datasetColumns.length === 0 && !loadingColumns && (
                              <p className="text-sm text-muted-foreground">
                                No dataset columns available. Please ensure a dataset is selected.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Invocation Step */}
                  <AccordionItem value="invocation">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('invocation')}
                        <span className="font-medium">Invocation</span>
                        {testedSteps.has('invocation') && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      {!testedSteps.has('preprocessing') && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800">
                            Please test the preprocessing step first before configuring invocation.
                          </p>
                        </div>
                      )}
                      <div className={!testedSteps.has('preprocessing') ? 'blur-sm pointer-events-none' : ''}>
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">API Request Configuration</CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestStep('invocation')}
                                disabled={testLoading.invocation}
                              >
                                {testLoading.invocation ? 'Testing...' : 'Test'}
                              </Button>
                            </div>
                            <CardDescription>
                              Configure your API request parameters and body
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <InvocationConfig
                              config={config.workflow.steps.invocation.input}
                              availableColumns={config.workflow.steps.preprocessing.input.input_columns as string[]}
                              onChange={(invocationConfig) => {
                                setConfig(prev => ({
                                  ...prev,
                                  workflow: {
                                    ...prev.workflow,
                                    steps: {
                                      ...prev.workflow.steps,
                                      invocation: {
                                        ...prev.workflow.steps.invocation,
                                        input: invocationConfig
                                      }
                                    }
                                  }
                                }));
                              }}
                              onTest={() => {
                                toast.info('Testing API request...');
                              }}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Postprocessing Step */}
                  <AccordionItem value="postprocessing">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('postprocessing')}
                        <span className="font-medium">Postprocessing</span>
                        {testedSteps.has('postprocessing') && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      {!testedSteps.has('invocation') && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800">
                            Please test the invocation step first before configuring postprocessing.
                          </p>
                        </div>
                      )}
                      <div className={!testedSteps.has('invocation') ? 'blur-sm pointer-events-none' : ''}>
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Response Processing Configuration</CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestStep('postprocessing')}
                                disabled={testLoading.postprocessing}
                              >
                                {testLoading.postprocessing ? 'Testing...' : 'Test'}
                              </Button>
                            </div>
                            <CardDescription>
                              Configure how to extract data from the API response
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <JsonPathSelector
                              value={config.workflow.steps.postprocessing.input.field as string}
                              onChange={(path) => updateStepInput('postprocessing', 'field', path)}
                              placeholder="Select the field to extract from the API response"
                              exampleJson={testResults.invocation?.results?.invocation?.response ? JSON.stringify(testResults.invocation.results.invocation.response) : undefined}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Evaluation Step */}
                  <AccordionItem value="evaluation">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('evaluation')}
                        <span className="font-medium">Evaluation</span>
                        {testedSteps.has('evaluation') && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      {!testedSteps.has('postprocessing') && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800">
                            Please test the postprocessing step first before configuring evaluation.
                          </p>
                        </div>
                      )}
                      <div className={!testedSteps.has('postprocessing') ? 'blur-sm pointer-events-none' : ''}>
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Evaluation Configuration</CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestStep('evaluation')}
                                disabled={testLoading.evaluation}
                              >
                                {testLoading.evaluation ? 'Testing...' : 'Test'}
                              </Button>
                            </div>
                            <CardDescription>
                              Configure metrics to evaluate the workflow performance
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <MetricsSelector
                              selectedMetrics={config.workflow.steps.evaluation.input.metrics as string[]}
                              onMetricsChange={(metrics) => updateStepInput('evaluation', 'metrics', metrics)}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

WorkflowConfiguration.displayName = 'WorkflowConfiguration';

export default WorkflowConfiguration;