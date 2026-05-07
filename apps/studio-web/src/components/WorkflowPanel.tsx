/**
 * WorkflowPanel — workflow selection and execution
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  List,
  Tag,
  Typography,
  Space,
  Select,
  message,
  Empty,
  Steps,
  Spin,
} from 'antd';
import {
  PlayCircleOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

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
      .catch(() => message.error('加载工作流失败'));
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
        message.success('工作流已启动');
        // Poll for status
        pollRun(data.runId);
      } else {
        message.error(data.error || '启动失败');
        setRunning(false);
      }
    } catch {
      message.error('请求失败');
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
            message.success('工作流执行完成');
          } else {
            message.error(`工作流执行失败: ${data.error}`);
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
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>
        <AppstoreOutlined style={{ marginRight: 8 }} />
        工作流
      </Title>
      <Paragraph type="secondary">
        选择一个工作流，配置参数后运行。工作流会自动执行各个阶段并生成产物。
      </Paragraph>

      {/* Workflow list */}
      <List
        grid={{ gutter: 16, column: 2 }}
        dataSource={workflows}
        renderItem={wf => (
          <List.Item>
            <Card
              hoverable
              onClick={() => setSelectedWorkflow(wf)}
              style={{
                border: selectedWorkflow?.id === wf.id ? '2px solid #1677ff' : undefined,
              }}
              size="small"
            >
              <Card.Meta
                title={
                  <Space>
                    <RocketOutlined />
                    {wf.name}
                  </Space>
                }
                description={
                  <>
                    <Text type="secondary" style={{ fontSize: 12 }}>{wf.description || '无描述'}</Text>
                    <div style={{ marginTop: 8 }}>
                      {wf.stages.map(s => (
                        <Tag key={s} style={{ marginBottom: 4 }}>{s}</Tag>
                      ))}
                    </div>
                  </>
                }
              />
            </Card>
          </List.Item>
        )}
      />

      {workflows.length === 0 && (
        <Empty description="暂无工作流定义" style={{ padding: 40 }} />
      )}

      {/* Run button */}
      {selectedWorkflow && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            loading={running}
          >
            运行 {selectedWorkflow.name}
          </Button>
        </div>
      )}

      {/* Run progress */}
      {currentRun && (
        <Card style={{ marginTop: 24 }} title="运行进度">
          <Steps
            direction="vertical"
            size="small"
            current={currentRun.logs.length - 1}
            status={currentRun.status === 'failed' ? 'error' : currentRun.status === 'completed' ? 'finish' : 'process'}
            items={currentRun.logs.map((log, i) => ({
              title: log.message,
              description: new Date(log.timestamp).toLocaleTimeString(),
              icon: log.level === 'error' ? <CloseCircleOutlined /> :
                    i === currentRun.logs.length - 1 && currentRun.status === 'running' ? <LoadingOutlined /> :
                    <CheckCircleOutlined />,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
