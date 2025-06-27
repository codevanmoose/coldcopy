'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Code, 
  Play, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Plus,
  Trash2,
  Copy,
  FileCode,
  Bug,
  Zap
} from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { 
  TransformFunction, 
  TransformParameter, 
  TransformTestCase, 
  PipedriveFieldMapping,
  BUILT_IN_TRANSFORMS 
} from './types';
import { useToast } from '@/components/ui/use-toast';

interface TransformFunctionBuilderProps {
  mapping: PipedriveFieldMapping | null;
  onSave: (transform: TransformFunction) => void;
}

export function TransformFunctionBuilder({ mapping, onSave }: TransformFunctionBuilderProps) {
  const [selectedTransform, setSelectedTransform] = useState<TransformFunction | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testError, setTestError] = useState('');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [parameters, setParameters] = useState<TransformParameter[]>([]);
  const [testCases, setTestCases] = useState<TransformTestCase[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (mapping?.transformFunction) {
      setSelectedTransform(mapping.transformFunction);
      if (mapping.transformFunction.type === 'custom') {
        setCustomCode(mapping.transformFunction.code || '');
      }
      setParameters(mapping.transformFunction.parameters || []);
      setTestCases(mapping.transformFunction.testCases || []);
    }
  }, [mapping]);

  const generateTransformTemplate = () => {
    const inputType = mapping?.coldcopyField.type || 'any';
    const outputType = mapping?.pipedriveField.field_type || 'any';
    
    return `// Transform function: ${inputType} → ${outputType}
// Input: value - The input value to transform
// Parameters: params - Object containing transform parameters
// Return: The transformed value

function transform(value, params) {
  // Example: Convert string to uppercase
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  
  // Add your transformation logic here
  
  return value;
}`;
  };

  const runTest = async () => {
    setIsTestRunning(true);
    setTestError('');
    setTestOutput('');

    try {
      let result;
      
      if (selectedTransform?.type === 'built-in') {
        // Simulate built-in transform execution
        result = await simulateBuiltInTransform(selectedTransform.id, testInput, parameters);
      } else {
        // Execute custom code
        const func = new Function('value', 'params', customCode + '\nreturn transform(value, params);');
        result = func(JSON.parse(testInput), parameters.reduce((acc, p) => {
          acc[p.name] = p.defaultValue;
          return acc;
        }, {} as any));
      }
      
      setTestOutput(JSON.stringify(result, null, 2));
    } catch (error: any) {
      setTestError(error.message);
    } finally {
      setIsTestRunning(false);
    }
  };

  const simulateBuiltInTransform = async (id: string, input: string, params: TransformParameter[]) => {
    const value = JSON.parse(input);
    
    switch (id) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'trim':
        return value.trim();
      case 'split_name':
        const parts = value.split(' ');
        return {
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || ''
        };
      case 'number_round':
        const decimals = params.find(p => p.name === 'decimals')?.defaultValue || 0;
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
      default:
        return value;
    }
  };

  const handleSave = () => {
    if (!selectedTransform) {
      toast({
        title: 'Error',
        description: 'Please select a transform function',
        variant: 'destructive',
      });
      return;
    }

    const transform: TransformFunction = {
      ...selectedTransform,
      code: selectedTransform.type === 'custom' ? customCode : undefined,
      parameters,
      testCases,
    };

    onSave(transform);
    toast({
      title: 'Transform saved',
      description: 'Transform function has been configured',
    });
  };

  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        name: `param${parameters.length + 1}`,
        type: 'string',
        required: false,
        defaultValue: '',
      },
    ]);
  };

  const addTestCase = () => {
    setTestCases([
      ...testCases,
      {
        input: '',
        expectedOutput: '',
        description: '',
      },
    ]);
  };

  if (!mapping) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Select a field mapping to configure transforms
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transform Function Builder</CardTitle>
        <CardDescription>
          Configure data transformation from {mapping.coldcopyField.label} ({mapping.coldcopyField.type}) 
          to {mapping.pipedriveField.name} ({mapping.pipedriveField.field_type})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="select" className="space-y-4">
          <TabsList>
            <TabsTrigger value="select">Select Transform</TabsTrigger>
            <TabsTrigger value="code">Custom Code</TabsTrigger>
            <TabsTrigger value="test">Test & Debug</TabsTrigger>
            <TabsTrigger value="cases">Test Cases</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <div>
              <Label>Built-in Transforms</Label>
              <ScrollArea className="h-96 mt-2">
                <div className="space-y-2">
                  {BUILT_IN_TRANSFORMS.filter(t => 
                    t.inputType === 'any' || 
                    t.inputType === mapping.coldcopyField.type ||
                    mapping.coldcopyField.type === 'any'
                  ).map((transform) => (
                    <Card
                      key={transform.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedTransform?.id === transform.id ? 'border-primary' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedTransform(transform)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            {transform.name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {transform.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {transform.inputType} → {transform.outputType}
                            </Badge>
                          </div>
                        </div>
                        {selectedTransform?.id === transform.id && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {selectedTransform?.parameters && selectedTransform.parameters.length > 0 && (
              <div>
                <Label>Parameters</Label>
                <div className="space-y-2 mt-2">
                  {selectedTransform.parameters.map((param, index) => (
                    <div key={param.name} className="flex items-center gap-2">
                      <Label className="w-32">{param.name}</Label>
                      <Input
                        value={parameters[index]?.defaultValue || param.defaultValue || ''}
                        onChange={(e) => {
                          const newParams = [...parameters];
                          newParams[index] = { ...param, defaultValue: e.target.value };
                          setParameters(newParams);
                        }}
                        placeholder={param.description}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Custom Transform Function</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomCode(generateTransformTemplate());
                  setSelectedTransform({
                    id: 'custom',
                    name: 'Custom Transform',
                    description: 'Custom transformation function',
                    type: 'custom',
                    inputType: mapping.coldcopyField.type,
                    outputType: mapping.pipedriveField.field_type,
                  });
                }}
              >
                <FileCode className="h-4 w-4 mr-2" />
                Generate Template
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Editor
                height="400px"
                language="javascript"
                theme="vs-dark"
                value={customCode}
                onChange={(value) => setCustomCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Parameters</Label>
                <Button variant="outline" size="sm" onClick={addParameter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>
              <div className="space-y-2">
                {parameters.map((param, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Name"
                      value={param.name}
                      onChange={(e) => {
                        const newParams = [...parameters];
                        newParams[index].name = e.target.value;
                        setParameters(newParams);
                      }}
                    />
                    <Select
                      value={param.type}
                      onValueChange={(value) => {
                        const newParams = [...parameters];
                        newParams[index].type = value;
                        setParameters(newParams);
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setParameters(parameters.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Input (JSON)</Label>
                <Textarea
                  className="font-mono mt-2"
                  rows={10}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder='{"value": "test data"}'
                />
              </div>
              <div>
                <Label>Test Output</Label>
                <Textarea
                  className="font-mono mt-2"
                  rows={10}
                  value={testOutput}
                  readOnly
                  placeholder="Transform output will appear here"
                />
              </div>
            </div>

            {testError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <Button onClick={runTest} disabled={isTestRunning}>
                {isTestRunning ? (
                  <>
                    <Bug className="h-4 w-4 mr-2 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cases" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Test Cases</Label>
              <Button variant="outline" size="sm" onClick={addTestCase}>
                <Plus className="h-4 w-4 mr-2" />
                Add Test Case
              </Button>
            </div>

            <div className="space-y-4">
              {testCases.map((testCase, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Description"
                      value={testCase.description}
                      onChange={(e) => {
                        const newCases = [...testCases];
                        newCases[index].description = e.target.value;
                        setTestCases(newCases);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Input</Label>
                        <Textarea
                          className="font-mono text-xs"
                          rows={3}
                          value={testCase.input}
                          onChange={(e) => {
                            const newCases = [...testCases];
                            newCases[index].input = e.target.value;
                            setTestCases(newCases);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Expected Output</Label>
                        <Textarea
                          className="font-mono text-xs"
                          rows={3}
                          value={testCase.expectedOutput}
                          onChange={(e) => {
                            const newCases = [...testCases];
                            newCases[index].expectedOutput = e.target.value;
                            setTestCases(newCases);
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTestCases(testCases.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onSave(selectedTransform!)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedTransform}>
            <Save className="h-4 w-4 mr-2" />
            Save Transform
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}