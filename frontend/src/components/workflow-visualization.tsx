'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    MarkerType,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
    Plus,
    Play,
    Edit,
    FileText,
    Settings,
    Database,
    Send,
    BarChart3
} from 'lucide-react';
import { WorkflowConfig, WorkflowStep } from '@/lib/types';

interface WorkflowVisualizationProps {
    workflowConfig: WorkflowConfig | null;
    suiteId: string;
    onCreateWorkflow: () => void;
    onEditStep: (stepName: string) => void;
    onRunWorkflow: () => void;
    onEditWorkflow: () => void;
    isReadOnly?: boolean;
}

// Custom node component for workflow steps
const WorkflowStepNode = ({ data }: { data: any }) => {
    const [isHovered, setIsHovered] = useState(false);
    const { hoveredNodeId, setHoveredNodeId } = data;

    const getStepIcon = (stepName: string) => {
        switch (stepName) {
            case 'database':
                return <Database className="w-7 h-7" />;
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

                <HoverCard>
                    <HoverCardTrigger asChild>
                        <Card
                            className={`${isHovered ? 'w-32 h-15' : 'w-15 h-15'} ${getStepColor(data.stepType)} cursor-pointer transition-all duration-200 ease-in-out`}
                            onMouseEnter={() => {
                                setIsHovered(true);
                                setHoveredNodeId(data.stepType);
                            }}
                            onMouseLeave={() => {
                                setIsHovered(false);
                                setHoveredNodeId(null);
                            }}
                        >
                            <CardContent className="p-0 h-full flex items-center justify-center gap-2">
                                {getStepIcon(data.stepType)}
                                {isHovered && (
                                    <span className="text-sm font-medium capitalize whitespace-nowrap">
                                        {data.stepType}
                                    </span>
                                )}
                            </CardContent>
                        </Card>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold capitalize">{data.stepType} Step</h4>
                            <p className="text-sm text-gray-600">
                                Configure database connection and data source for the workflow.
                            </p>
                        </div>
                    </HoverCardContent>
                </HoverCard>

                {/* Output handle (source) - always present for database */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id="output"
                    style={{
                        background: '#e2e8f0',
                        width: 8,
                        height: 8,
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
            {/* Input handle (target) - all nodes except database have input */}
            <Handle
                type="target"
                position={Position.Left}
                id="input"
                style={{
                    background: '#e2e8f0',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: '1px solid #cbd5e1'
                }}
            />

            <HoverCard>
                <HoverCardTrigger asChild>
                    <Card
                        className={`${isHovered ? 'w-32 h-15' : 'w-15 h-15'} ${getStepColor(data.stepType)} cursor-pointer transition-all duration-200 ease-in-out`}
                        onMouseEnter={() => {
                            setIsHovered(true);
                            setHoveredNodeId(data.stepType);
                        }}
                        onMouseLeave={() => {
                            setIsHovered(false);
                            setHoveredNodeId(null);
                        }}
                    >
                        <CardContent className="p-0 h-full flex items-center justify-center gap-2">
                            {getStepIcon(data.stepType)}
                            {isHovered && (
                                <span className="text-sm font-medium capitalize whitespace-nowrap">
                                    {data.stepType}
                                </span>
                            )}
                        </CardContent>
                    </Card>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold capitalize">{data.stepType} Step</h4>
                        <p className="text-sm text-gray-600">
                            {data.stepType === 'preprocessing' && 'Transform and prepare data before processing.'}
                            {data.stepType === 'invocation' && 'Execute the main workflow logic and processing.'}
                            {data.stepType === 'postprocessing' && 'Process and format the results after invocation.'}
                            {data.stepType === 'evaluation' && 'Evaluate and analyze the workflow results.'}
                        </p>
                    </div>
                </HoverCardContent>
            </HoverCard>

            {/* Output handle (source) - hidden for last node */}
            {data.stepType !== 'evaluation' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="output"
                    style={{
                        background: '#e2e8f0',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        border: '1px solid #cbd5e1'
                    }}
                />
            )}
        </div>
    );
};

const nodeTypes = {
    workflowStep: WorkflowStepNode,
};

export default function WorkflowVisualization({
    workflowConfig,
    suiteId,
    onCreateWorkflow,
    onEditStep,
    onRunWorkflow,
    onEditWorkflow,
    isReadOnly = false
}: WorkflowVisualizationProps) {
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Create hardcoded nodes and edges for the workflow steps
    const { initialNodes, initialEdges } = useMemo(() => {
        const stepNames = ['database', 'preprocessing', 'invocation', 'postprocessing', 'evaluation'];

        const nodes: Node[] = stepNames.map((stepName, index) => {
            // Calculate position with gaps when hovering
            let xPosition = index * 130 + 50;
            if (hoveredNodeId) {
                const hoveredIndex = stepNames.indexOf(hoveredNodeId);
                if (hoveredIndex !== -1) {
                    // Add extra gap after the hovered node
                    if (index > hoveredIndex) {
                        xPosition += 30; // Additional gap for nodes after hovered node
                    }
                }
            }

            return {
                id: stepName,
                type: 'workflowStep',
                position: { x: xPosition, y: 100 },
                data: {
                    stepType: stepName,
                    stepData: workflowConfig?.workflow.steps[stepName as keyof typeof workflowConfig.workflow.steps] || null,
                    onEdit: onEditStep,
                    isReadOnly,
                    hoveredNodeId,
                    setHoveredNodeId
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
                style: { stroke: '#e2e8f0', strokeWidth: 2 },
            },
            {
                id: 'preprocessing-invocation',
                source: 'preprocessing',
                target: 'invocation',
                sourceHandle: 'output',
                targetHandle: 'input',
                type: 'straight',
                style: { stroke: '#e2e8f0', strokeWidth: 2 },
            },
            {
                id: 'invocation-postprocessing',
                source: 'invocation',
                target: 'postprocessing',
                sourceHandle: 'output',
                targetHandle: 'input',
                type: 'straight',
                style: { stroke: '#e2e8f0', strokeWidth: 2 },
            },
            {
                id: 'postprocessing-evaluation',
                source: 'postprocessing',
                target: 'evaluation',
                sourceHandle: 'output',
                targetHandle: 'input',
                type: 'straight',
                style: { stroke: '#e2e8f0', strokeWidth: 2 },
            },
        ];

        return { initialNodes: nodes, initialEdges: edges };
    }, [workflowConfig, onEditStep, isReadOnly, hoveredNodeId]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes when hover state changes
    React.useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Empty state when no workflow config
    if (!workflowConfig) {
        return (
            <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center space-y-4">
                    <div className="mx-auto w-15 h-15 bg-gray-200 rounded-full flex items-center justify-center">
                        <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No Workflow Configured
                        </h3>
                        <p className="text-gray-600 mb-4 max-w-md">
                            Create a workflow to define the evaluation pipeline with preprocessing,
                            invocation, postprocessing, and evaluation steps.
                        </p>
                        <Button onClick={onCreateWorkflow} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create Workflow
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Workflow Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{workflowConfig.workflow.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                            v{workflowConfig.workflow.version}
                        </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{workflowConfig.workflow.description}</p>
                </div>
            </div>

            {/* React Flow Visualization */}
            <div className="h-92 border rounded-lg bg-white">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={{
                        type: 'straight',
                        style: { strokeWidth: 2, stroke: '#e2e8f0' }
                    }}
                    fitView
                    fitViewOptions={{
                        padding: 0.2, // Adds 20% padding around the nodes, creating a zoomed out effect
                        minZoom: 0.1,
                        maxZoom: 1.5
                    }}
                    attributionPosition="bottom-left"
                    nodesDraggable={false}
                    zoomOnScroll={false}
                    panOnDrag={false}
                    zoomOnDoubleClick={false}
                    style={{
                        transition: 'all 0.3s ease-in-out'
                    }}
                >
                    <Controls />
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                </ReactFlow>
            </div>
        </div>
    );
}