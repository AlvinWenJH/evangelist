'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MentionInput } from '@/components/ui/mention-input';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { Plus, Trash2, Send } from 'lucide-react';
import { InvocationInput, KeyValuePair, RequestBodyType } from '@/lib/types';

interface InvocationConfigProps {
  config: InvocationInput;
  onChange: (config: InvocationInput) => void;
  onTest?: () => void;
  availableColumns?: string[];
}

const defaultKeyValuePair = (): KeyValuePair => ({
  key: '',
  value: '',
  enabled: true,
});

export default function InvocationConfig({ config, onChange, onTest, availableColumns = [] }: InvocationConfigProps) {
  const [activeSection, setActiveSection] = useState<'params' | 'body'>('params');

  const updateConfig = useCallback((updates: Partial<InvocationInput>) => {
    onChange({ ...config, ...updates });
  }, [config, onChange]);

  const updateKeyValueList = useCallback((
    listType: 'params' | 'formData' | 'json',
    index: number,
    field: keyof KeyValuePair,
    value: string | boolean
  ) => {
    const currentList = listType === 'formData'
      ? config.body?.formData || []
      : listType === 'json'
      ? config.body?.json || []
      : config[listType] || [];

    const newList = [...currentList];
    newList[index] = { ...newList[index], [field]: value };

    if (listType === 'formData') {
      updateConfig({
        body: { ...config.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...config.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [config, updateConfig]);

  const addKeyValuePair = useCallback((listType: 'params' | 'formData' | 'json') => {
    const currentList = listType === 'formData'
      ? config.body?.formData || []
      : listType === 'json'
      ? config.body?.json || []
      : config[listType] || [];

    const newList = [...currentList, defaultKeyValuePair()];

    if (listType === 'formData') {
      updateConfig({
        body: { ...config.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...config.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [config, updateConfig]);

  const removeKeyValuePair = useCallback((
    listType: 'params' | 'formData' | 'json',
    index: number
  ) => {
    const currentList = listType === 'formData'
      ? config.body?.formData || []
      : listType === 'json'
      ? config.body?.json || []
      : config[listType] || [];

    const newList = currentList.filter((_, i) => i !== index);

    if (listType === 'formData') {
      updateConfig({
        body: { ...config.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...config.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [config, updateConfig]);

  const renderKeyValueTable = (
    listType: 'params' | 'formData' | 'json',
    title: string
  ) => {
    const list = listType === 'formData'
      ? config.body?.formData || []
      : listType === 'json'
      ? config.body?.json || []
      : config[listType] || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addKeyValuePair(listType)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {list.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
              <div className="w-8"></div>
              <div className="w-32">Key</div>
              <div className="flex-1">Value</div>
              <div className="w-8"></div>
            </div>

            {/* Items */}
            {list.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                <div className="w-8 flex justify-center">
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={(checked) =>
                      updateKeyValueList(listType, index, 'enabled', checked as boolean)
                    }
                  />
                </div>
                <div className="w-32">
                  <Input
                    value={item.key}
                    onChange={(e) =>
                      updateKeyValueList(listType, index, 'key', e.target.value)
                    }
                    placeholder="Key"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="flex-1">
                  <MentionInput
                    value={item.value}
                    onChange={(value) =>
                      updateKeyValueList(listType, index, 'value', value)
                    }
                    placeholder="Type @ to mention columns"
                    availableColumns={availableColumns}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="w-8 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeKeyValuePair(listType, index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No {title.toLowerCase()} added yet</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addKeyValuePair(listType)}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {getSingularTitle(title)}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const getEnabledCount = (list: KeyValuePair[] | undefined) => {
    if (!Array.isArray(list)) return 0;
    return list.filter(item => item.enabled && item.key.trim()).length;
  };

  const getSingularTitle = (title: string) => {
    return 'Item';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>API Request Configuration</span>
          {onTest && (
            <Button onClick={onTest} size="sm">
              <Send className="h-4 w-4 mr-1" />
              Test
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Configure your API request parameters and body
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL and Method */}
        <div className="flex gap-2">
          <div className="w-24">
            <Select
              value={config.method}
              onValueChange={(value) => updateConfig({ method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Input
              value={config.url}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="Enter request URL"
            />
          </div>
        </div>

        {/* Section selector */}
        <div className="space-y-2">
          <div className="space-y-2">
            <Label>Configuration Section</Label>
            <Select
              value={activeSection}
              onValueChange={(value: string) => setActiveSection(value as 'params' | 'body')}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="params">
                  Params {getEnabledCount(config.params) > 0 && `(${getEnabledCount(config.params)})`}
                </SelectItem>
                <SelectItem value="body">Body</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional rendering based on selected section */}
          {activeSection === 'params' && (
            <div className="mt-4">
              {renderKeyValueTable('params', 'Query Parameters')}
            </div>
          )}

          {activeSection === 'body' && (
            <div className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label>Body Type</Label>
                <Select
                  value={config.bodyType}
                  onValueChange={(value: RequestBodyType) => updateConfig({ bodyType: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="formData">Form Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.bodyType === 'json' && (
                renderKeyValueTable('json', 'JSON Body')
              )}

              {config.bodyType === 'formData' && (
                renderKeyValueTable('formData', 'Form Data')
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}