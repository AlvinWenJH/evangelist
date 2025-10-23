'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MentionInput } from '@/components/ui/mention-input';
import { Plus, Trash2 } from 'lucide-react';
import { InvocationInput, KeyValuePair, RequestBodyType, LegacyInvocationInput } from '@/lib/types';

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

// Helper function to convert new input_type format to legacy format for UI compatibility
const convertToLegacyFormat = (config: InvocationInput): LegacyInvocationInput => {
  const params = config.input_type.params?.data || [];
  
  let bodyType: RequestBodyType = 'none';
  let body = { json: [] as KeyValuePair[], formData: [] as KeyValuePair[] };
  
  // Check for JSON body type
  if (config.input_type.body?.json) {
    bodyType = 'json';
    body.json = config.input_type.body.json;
  } 
  // Check for form data body type
  else if (config.input_type.body?.form) {
    bodyType = 'formData';
    body.formData = config.input_type.body.form;
  }
  // If body object exists but is empty, default to 'none'
  else if (config.input_type.body) {
    bodyType = 'none';
  }
  
  return {
    url: config.url,
    method: config.method,
    params,
    bodyType,
    body
  };
};

// Helper function to convert legacy format back to new input_type format
const convertFromLegacyFormat = (legacyConfig: LegacyInvocationInput, originalConfig: InvocationInput): InvocationInput => {
  const input_type: InvocationInput['input_type'] = {};
  
  // Handle params - always include if they exist
  if (legacyConfig.params && legacyConfig.params.length > 0) {
    input_type.params = { data: legacyConfig.params };
  }
  
  // Handle body based on bodyType
  if (legacyConfig.bodyType === 'json') {
    input_type.body = { json: legacyConfig.body.json || [] };
  } else if (legacyConfig.bodyType === 'formData') {
    input_type.body = { form: legacyConfig.body.formData || [] };
  } else if (legacyConfig.bodyType === 'none') {
    // Don't include body in input_type if none is selected
    // This ensures the structure is clean
  }
  
  return {
    url: legacyConfig.url,
    method: legacyConfig.method,
    headers: originalConfig.headers,
    input_type
  };
};

export default function InvocationConfig({ config, onChange, onTest, availableColumns = [] }: InvocationConfigProps) {
  // Determine initial active section based on input_type structure
  const getInitialActiveSection = (): 'params' | 'body' => {
    // Check if body structure exists (json or form) - don't require non-empty arrays
    if (config.input_type.body?.json !== undefined) {
      return 'body';
    }
    if (config.input_type.body?.form !== undefined) {
      return 'body';
    }
    // Check if params structure exists
    if (config.input_type.params?.data !== undefined) {
      return 'params';
    }
    // Default to params if nothing is configured
    return 'params';
  };

  const [activeSection, setActiveSection] = useState<'params' | 'body'>(getInitialActiveSection());

  // Update active section when config changes, but only if user hasn't manually selected a section
  const [userHasSelectedSection, setUserHasSelectedSection] = useState(false);
  
  useEffect(() => {
    // Only auto-update if user hasn't manually selected a section
    if (!userHasSelectedSection) {
      setActiveSection(getInitialActiveSection());
    }
  }, [config, userHasSelectedSection]);

  // Convert to legacy format for internal use
  const legacyConfig = convertToLegacyFormat(config);

  const updateConfig = useCallback((updates: Partial<LegacyInvocationInput>) => {
    const updatedLegacyConfig = { ...legacyConfig, ...updates };
    const newConfig = convertFromLegacyFormat(updatedLegacyConfig, config);
    onChange(newConfig);
  }, [legacyConfig, config, onChange]);

  const handleBodyTypeChange = useCallback((newBodyType: RequestBodyType) => {
    const updatedLegacyConfig = { 
      ...legacyConfig, 
      bodyType: newBodyType,
      body: {
        json: newBodyType === 'json' ? (legacyConfig.body?.json || []) : [],
        formData: newBodyType === 'formData' ? (legacyConfig.body?.formData || []) : []
      }
    };
    const newConfig = convertFromLegacyFormat(updatedLegacyConfig, config);
    
    // Ensure we stay on the body section when changing body type
    setActiveSection('body');
    setUserHasSelectedSection(true);
    
    onChange(newConfig);
  }, [legacyConfig, config, onChange]);

  const updateKeyValueList = useCallback((
    listType: 'params' | 'formData' | 'json',
    index: number,
    field: keyof KeyValuePair,
    value: string | boolean
  ) => {
    const currentList = listType === 'formData'
      ? legacyConfig.body?.formData || []
      : listType === 'json'
        ? legacyConfig.body?.json || []
        : legacyConfig[listType] || [];

    const newList = [...currentList];
    newList[index] = { ...newList[index], [field]: value };

    if (listType === 'formData') {
      updateConfig({
        body: { ...legacyConfig.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...legacyConfig.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [legacyConfig, updateConfig]);

  const addKeyValuePair = useCallback((listType: 'params' | 'formData' | 'json') => {
    const currentList = listType === 'formData'
      ? legacyConfig.body?.formData || []
      : listType === 'json'
        ? legacyConfig.body?.json || []
        : legacyConfig[listType] || [];

    const newList = [...currentList, defaultKeyValuePair()];

    if (listType === 'formData') {
      updateConfig({
        body: { ...legacyConfig.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...legacyConfig.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [legacyConfig, updateConfig]);

  const removeKeyValuePair = useCallback((
    listType: 'params' | 'formData' | 'json',
    index: number
  ) => {
    const currentList = listType === 'formData'
      ? legacyConfig.body?.formData || []
      : listType === 'json'
        ? legacyConfig.body?.json || []
        : legacyConfig[listType] || [];

    const newList = currentList.filter((_, i) => i !== index);

    if (listType === 'formData') {
      updateConfig({
        body: { ...legacyConfig.body || {}, formData: newList }
      });
    } else if (listType === 'json') {
      updateConfig({
        body: { ...legacyConfig.body || {}, json: newList }
      });
    } else {
      updateConfig({ [listType]: newList });
    }
  }, [legacyConfig, updateConfig]);

  const renderKeyValueTable = (
    listType: 'params' | 'formData' | 'json',
    title: string
  ) => {
    const list = listType === 'formData'
      ? legacyConfig.body?.formData || []
      : listType === 'json'
        ? legacyConfig.body?.json || []
        : legacyConfig[listType] || [];

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
              Add {getSingularTitle()}
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

  const getSingularTitle = () => {
    return 'Item';
  };

  return (
    <div className="space-y-6">
      {/* URL and Method */}
      <div className="flex gap-2">
        <div className="w-24">
          <Select
            value={legacyConfig.method}
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
            value={legacyConfig.url}
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
            onValueChange={(value: string) => {
              setActiveSection(value as 'params' | 'body');
              setUserHasSelectedSection(true);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="params">
                Params {getEnabledCount(legacyConfig.params) > 0 && `(${getEnabledCount(legacyConfig.params)})`}
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
                value={legacyConfig.bodyType}
                onValueChange={handleBodyTypeChange}
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

            {legacyConfig.bodyType === 'json' && (
              renderKeyValueTable('json', 'JSON Body')
            )}

            {legacyConfig.bodyType === 'formData' && (
              renderKeyValueTable('formData', 'Form Data')
            )}
          </div>
        )}
      </div>
    </div>
  );
}