/**
 * WorkflowPanel — workflow selection and execution
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@heroui/react/card';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { Spinner } from '@heroui/react/spinner';
import { Text } from '@heroui/react/text';
import {
  PlayCircle,
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
} from 'lucide-react';

const API = '/api';

interface Workflow {
  id: string;
  name: string;
  description: string;
  stages: string[];
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt: number | null;
  logs: Array<{ timestamp: number; level: string; message: string }>;
}

export function WorkflowPanel({ profileId }: { profileId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);

  useEffect(() => {
    fetch(`${API}/workflows`)
      .then(r => r.json())
      .then(setWorkflows)
      .catch(() => console.error('加载工作流失败'));
  }, []);

  const handleRun = async () => {
    if (!selectedWorkflow) return;
    setRunning(true);

    try {
      const res = await fetch(`${API}/workflows/${selectedWorkflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();

      if (data.ok) {
        console.log('工作流已启动');
        // Poll for status
        pollRun(data.runId);
      } else {
        console.error(data.error || '启动失败');
        setRunning(false);
      }
    } catch {
      console.error('请求失败');
      setRunning(false);
    }
  };

  const pollRun = async (runId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API}/runs/${runId}`);
        const data = await res.json();
        setCurrentRun(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setRunning(false);
          if (data.status === 'completed') {
            console.log('工作流执行完成');
          } else {
            console.error(`工作流执行失败: ${data.error}`);
          }
          return;
        }

        // Continue polling
        setTimeout(poll, 1000);
      } catch {
        setRunning(false);
      }
    };
    poll();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <h3 className="flex items-center gap-2 text-xl font-semibold">
        <LayoutGrid className="h-5 w-5" />
        工作流
      </h3>
      <Text className="mt-1 text-sm text-default-500">
        选择一个工作流，配置参数后运行。工作流会自动执行各个阶段并生成产物。
      </Text>

      {/* Workflow list */}
      {workflows.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workflows.map(wf => (
            <Card
              key={wf.id}
              onClick={() => setSelectedWorkflow(wf)} className={`cursor-pointer ${
                selectedWorkflow?.id === wf.id
                  ? 'border-2 border-primary'
                  : 'border border-default-200'
              }`}
            >
              <CardHeader className="flex items-center gap-2 pb-1">
                <Rocket className="h-4 w-4 text-default-600" />
                <span className="text-sm font-medium">{wf.name}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <Text className="text-xs text-default-400">
                  {wf.description || '无描述'}
                </Text>
                <div className="mt-2 flex flex-wrap gap-1">
                  {wf.stages.map(s => (
                    <Chip key={s} size="sm" variant="soft">
                      {s}
                    </Chip>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-default-400">
          <LayoutGrid className="mb-3 h-10 w-10" />
          <Text className="text-sm">暂无工作流定义</Text>
        </div>
      )}

      {/* Run button */}
      {selectedWorkflow && (
        <div className="mt-6 text-center">
          <Button
            variant="primary"
            size="lg"
            onPress={handleRun}
            isDisabled={running}
          >
            <PlayCircle className="h-5 w-5 inline mr-1.5" /> 运行 {selectedWorkflow.name}
          </Button>
        </div>
      )}

      {/* Run progress */}
      {currentRun && (
        <Card className="mt-6">
          <CardHeader>
            <span className="text-sm font-semibold">运行进度</span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-0">
              {currentRun.logs.map((log, i) => {
                const isLast = i === currentRun.logs.length - 1;
                const isError = log.level === 'error';
                const isRunning = isLast && currentRun.status === 'running';

                // Determine icon & colours
                let icon: React.ReactNode;
                let dotColor: string;
                if (isError) {
                  icon = <XCircle className="h-4 w-4 text-danger" />;
                  dotColor = 'bg-danger';
                } else if (isRunning) {
                  icon = <Loader2 className="h-4 w-4 animate-spin text-primary" />;
                  dotColor = 'bg-primary';
                } else {
                  icon = <CheckCircle2 className="h-4 w-4 text-success" />;
                  dotColor = 'bg-success';
                }

                return (
                  <div key={i} className="flex items-start gap-3">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          isError
                            ? 'bg-danger-100'
                            : isRunning
                              ? 'bg-primary-100'
                              : 'bg-success-100'
                        }`}
                      >
                        {icon}
                      </div>
                      {i < currentRun.logs.length - 1 && (
                        <div className={`w-0.5 h-6 ${dotColor} opacity-30`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-4">
                      <Text className="text-sm font-medium">{log.message}</Text>
                      <Text className="text-xs text-default-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </div>
                  </div>
                );
              })}

              {/* Spinner while running and no logs yet */}
              {currentRun.logs.length === 0 && currentRun.status === 'running' && (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <Text className="text-sm text-default-500">正在启动…</Text>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
