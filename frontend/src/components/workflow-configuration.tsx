'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowConfig, WorkflowStep, SuiteConfig, Suite, InvocationInput } from '@/lib/types';
import DatasetPreviewComponent from './dataset-preview';
import { formatDate } from '@/lib/date-utils';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { apiClient } from '@/lib/api';
import InvocationConfig from './invocation-config';
import { JsonPathSelector } from '@/components/ui/json-path-selector';
import { MetricsSelector } from '@/components/ui/metrics-selector';

interface WorkflowConfigurationProps {
  suiteId: string;
  initialConfig?: WorkflowConfig | null;
  suiteConfig?: SuiteConfig | null;
  suite?: Suite | null;
  onConfigChange?: (config: WorkflowConfig) => void;
}

// Custom node component for vertical workflow steps (without hover cards)
const VerticalWorkflowStepNode = ({ data }: { data: any }) => {
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
        {/* No input handle for database node (it's the first node) */}

        <Card className={`w-16 h-16 ${getStepColor(data.stepType)}`}>
          <CardContent className="p-0 h-full flex items-center justify-center">
            {getStepIcon(data.stepType)}
          </CardContent>
        </Card>

        {/* Output handle (source) - always present for database */}
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
      {/* Input handle (target) - hidden for first node */}
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

      <Card className={`w-36 ${getStepColor(data.stepType)}`}>
        <CardContent className="p-1.5">
          <div className="flex items-center gap-1.5">
            {getStepIcon(data.stepType)}
            <h3 className="text-xs font-medium capitalize">
              {data.stepType}
            </h3>
          </div>
          {data.stepData && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate leading-tight">
              {data.stepData.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Output handle (source) - hidden for last node */}
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

export default function WorkflowConfiguration({
  suiteId,
  initialConfig,
  suiteConfig,
  suite,
  onConfigChange
}: WorkflowConfigurationProps) {
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
              params: [],
              bodyType: "none" as const,
              body: {
                json: [],
                formData: []
              }
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

  // Auto-collapse on smaller screens for responsive design
  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth < 1024; // Collapse below lg breakpoint
      setIsFlowCollapsed(shouldCollapse);
    };

    // Check initial screen size
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create vertical nodes and edges for the workflow steps
  const { initialNodes, initialEdges } = useMemo(() => {
    const stepNames = ['database', 'preprocessing', 'invocation', 'postprocessing', 'evaluation'];

    // Calculate positions with different spacing
    let cumulativeY = 20; // Starting position
    const firstGap = 35; // Smaller gap after database node
    const regularGap = 80; // Regular gap between other nodes
    const databaseHeight = 64; // w-16 h-16 = 64px
    const regularNodeHeight = 48; // Estimated height based on content and padding

    const nodes: Node[] = stepNames.map((stepName, index) => {
      // Center-align the database node since it's smaller (64px vs 144px width)
      const xPosition = stepName === 'database' ? 50 : 10; // (144-64)/2 + 10 = 50

      const yPosition = cumulativeY;

      // Update cumulative Y for next node with different gaps
      if (stepName === 'database') {
        cumulativeY += databaseHeight + firstGap; // Use smaller gap after database
      } else {
        cumulativeY += regularNodeHeight + regularGap; // Use regular gap for other nodes
      }

      return {
        id: stepName,
        type: 'verticalWorkflowStep',
        position: { x: xPosition, y: yPosition },
        data: {
          stepType: stepName,
          stepData: config?.workflow.steps[stepName as keyof typeof config.workflow.steps] || null,
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
  }, [config]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Notify parent component when config changes
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const updateWorkflowInfo = (field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      workflow: {
        ...prev.workflow,
        [field]: value
      }
    }));
  };

  const updateStepInfo = (stepName: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      workflow: {
        ...prev.workflow,
        steps: {
          ...prev.workflow.steps,
          [stepName]: {
            ...prev.workflow.steps[stepName as keyof typeof prev.workflow.steps],
            [field]: value
          }
        }
      }
    }));
  };

  const updateStepInput = (stepName: string, inputField: string, value: any) => {
    setConfig(prev => {
      const currentStep = prev.workflow.steps[stepName as keyof typeof prev.workflow.steps];
      const currentInput = currentStep?.input || {};

      return {
        ...prev,
        workflow: {
          ...prev.workflow,
          steps: {
            ...prev.workflow.steps,
            [stepName]: {
              description: currentStep?.description || "",
              script: currentStep?.script || "",
              input: {
                ...currentInput,
                [inputField]: value
              }
            }
          }
        }
      };
    });
  };



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

  // Update input columns handling for multiselect
  const updateInputColumns = (selectedColumns: string[]) => {
    updateStepInput('preprocessing', 'input_columns', selectedColumns);
  };

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
      {/* Single Card with Complete Workflow Configuration */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="space-y-4">

          {/* Version and Last Updated */}
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
            {/* Left Section - Workflow Diagram (collapsible) */}
            {!isFlowCollapsed && (
              <>
                <div className="w-2/5 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-[500px]">
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
                </div>

                {/* Vertical Separator */}
                <Separator orientation="vertical" className="h-full" />
              </>
            )}

            {/* Toggle Button */}
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

            {/* Right Section - Configuration Form (dynamic width) */}
            <div className={`${isFlowCollapsed ? 'w-full' : 'w-3/5'} p-6 overflow-y-auto space-y-6 min-h-0 flex flex-col`}>
              {/* Workflow Steps Configuration */}
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
                    <AccordionContent className="py-4">
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
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      <div className="space-y-3">
                        <Label>Input Columns</Label>
                        <MultiSelect
                          options={datasetColumns}
                          selected={config.workflow.steps.preprocessing.input.input_columns}
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
                          value={config.workflow.steps.preprocessing.input.groundtruth_column}
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
                    </AccordionContent>
                  </AccordionItem>

                  {/* Invocation Step */}
                  <AccordionItem value="invocation">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('invocation')}
                        <span className="font-medium">Invocation</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="py-4">
                      <InvocationConfig
                        config={config.workflow.steps.invocation.input as InvocationInput}
                        availableColumns={config.workflow.steps.preprocessing.input.input_columns}
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
                          if (onConfigChange) {
                            const newConfig = {
                              ...config,
                              workflow: {
                                ...config.workflow,
                                steps: {
                                  ...config.workflow.steps,
                                  invocation: {
                                    ...config.workflow.steps.invocation,
                                    input: invocationConfig
                                  }
                                }
                              }
                            };
                            onConfigChange(newConfig);
                          }
                        }}
                        onTest={() => {
                          toast.info('Testing API request...');
                          // TODO: Implement actual API testing
                        }}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Postprocessing Step */}
                  <AccordionItem value="postprocessing">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('postprocessing')}
                        <span className="font-medium">Postprocessing</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      <JsonPathSelector
                        value={config.workflow.steps.postprocessing.input.field}
                        onChange={(path) => updateStepInput('postprocessing', 'field', path)}
                        placeholder="Select the field to extract from the API response"
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Evaluation Step */}
                  <AccordionItem value="evaluation">
                    <AccordionTrigger className="w-full justify-between p-4 h-auto hover:no-underline">
                      <div className="flex items-center gap-3">
                        {getStepIcon('evaluation')}
                        <span className="font-medium">Evaluation</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 py-4">
                      <MetricsSelector
                        selectedMetrics={config.workflow.steps.evaluation.input.metrics}
                        onMetricsChange={(metrics) => updateStepInput('evaluation', 'metrics', metrics)}
                      />
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
}