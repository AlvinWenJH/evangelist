'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Hash, 
  ToggleLeft,
  Braces,
  Brackets,
  Quote
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface JsonPathSelectorProps {
  value: string;
  onChange: (path: string) => void;
  exampleJson?: string;
  placeholder?: string;
  className?: string;
}

interface JsonNode {
  key: string;
  value: any;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  path: string;
  children?: JsonNode[];
  isExpanded?: boolean;
}

const DEFAULT_EXAMPLE_JSON = {
  "status": "success",
  "message": "Items found",
  "result": [
    {
      "id": 1,
      "text": "First item",
      "active": true
    },
    {
      "id": 2,
      "text": "Second item",
      "active": false
    }
  ]
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'object': return <Braces className="w-3 h-3 text-blue-500" />;
    case 'array': return <Brackets className="w-3 h-3 text-green-500" />;
    case 'string': return <Quote className="w-3 h-3 text-yellow-500" />;
    case 'number': return <Hash className="w-3 h-3 text-purple-500" />;
    case 'boolean': return <ToggleLeft className="w-3 h-3 text-orange-500" />;
    default: return <FileText className="w-3 h-3 text-gray-500" />;
  }
};

const getValueType = (value: any): JsonNode['type'] => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'null';
};

const parseJsonToNodes = (obj: any, parentPath = '', parentKey = 'root'): JsonNode => {
  const type = getValueType(obj);
  const currentPath = parentPath ? `${parentPath}.${parentKey}` : parentKey;
  
  const node: JsonNode = {
    key: parentKey,
    value: obj,
    type,
    path: currentPath === 'root' ? '' : currentPath.replace('root.', ''),
    isExpanded: true
  };

  if (type === 'object' && obj !== null) {
    node.children = Object.entries(obj).map(([key, value]) => 
      parseJsonToNodes(value, currentPath, key)
    );
  } else if (type === 'array') {
    node.children = obj.map((item: any, index: number) => 
      parseJsonToNodes(item, currentPath, `[${index}]`)
    );
  }

  return node;
};

const getValueAtPath = (obj: any, path: string): any => {
  if (!path) return obj;
  
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
        current = current[arrayKey][index];
      } else {
        current = current[key];
      }
    }
    
    return current;
  } catch (error) {
    return undefined;
  }
};

export function JsonPathSelector({ 
  value, 
  onChange, 
  exampleJson, 
  placeholder = "Enter JSON path (e.g., result.text)",
  className 
}: JsonPathSelectorProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const currentJson = useMemo(() => {
    if (exampleJson) {
      try {
        return JSON.parse(exampleJson);
      } catch {
        return null;
      }
    }
    return DEFAULT_EXAMPLE_JSON;
  }, [exampleJson]);

  const jsonTree = useMemo(() => {
    if (!currentJson) return null;
    return parseJsonToNodes(currentJson);
  }, [currentJson]);



  const toggleNode = useCallback((path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const selectPath = useCallback((path: string) => {
    onChange(path);
  }, [onChange]);

  const renderJsonNode = useCallback((node: JsonNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.path) || depth === 0;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = value === node.path;

    return (
      <div key={node.path} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors",
            isSelected && "bg-primary/10 border border-primary/20",
            depth > 0 && "ml-4"
          )}
          onClick={() => selectPath(node.path)}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.path);
              }}
            >
              {isExpanded ? 
                <ChevronDown className="w-3 h-3" /> : 
                <ChevronRight className="w-3 h-3" />
              }
            </Button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          {getTypeIcon(node.type)}
          
          <span className="font-mono text-sm">
            {node.key === 'root' ? 'Response' : node.key}
          </span>
          
          <Badge variant="outline" className="text-xs">
            {node.type}
          </Badge>
          
          {node.path && (
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              {node.path}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children?.map(child => renderJsonNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedNodes, value, toggleNode, selectPath]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label>Response Field Path</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">JSON Structure</CardTitle>
          <CardDescription>
            Click on any field to select its path
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full">
            {jsonTree && renderJsonNode(jsonTree)}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}