/**
 * RunHistory — workflow run history and details
 */

import { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Typography,
  Button,
  Space,
  Modal,
  Timeline,
  Empty,
  message,
} from 'antd';
import {
  HistoryOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API = '/api';

interface RunSummary {
  id: string;
  workflowId: string;
  sessionId: string | null;
  profileId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

interface RunDetail extends RunSummary {
  result: unknown;
  logs: Array<{ timestamp: number; level: string; message: string }>;
}

export function RunHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailRun, setDetailRun] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/runs`);
      const data = await res.json();
      setRuns(data);
    } catch {
      message.error('加载运行历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const showDetail = async (runId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/runs/${runId}`);
      const data = await res.json();
      setDetailRun(data);
    } catch {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text>,
    },
    {
      title: '工作流',
      dataIndex: 'workflowId',
      key: 'workflowId',
      render: (id: string) => <Tag color="blue">{id}</Tag>,
    },
    {
      title: 'Profile',
      dataIndex: 'profileId',
      key: 'profileId',
      render: (id: string) => <Tag>{id}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode }> = {
          pending: { color: 'default', icon: <ClockCircleOutlined /> },
          running: { color: 'processing', icon: <LoadingOutlined /> },
          completed: { color: 'success', icon: <CheckCircleOutlined /> },
          failed: { color: 'error', icon: <CloseCircleOutlined /> },
        };
        const { color, icon } = map[status] ?? map.pending;
        return <Tag color={color} icon={icon}>{status}</Tag>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (ts: number) => new Date(ts).toLocaleString(),
    },
    {
      title: '耗时',
      key: 'duration',
      render: (_: unknown, record: RunSummary) => {
        if (!record.completedAt) return '-';
        const ms = record.completedAt - record.startedAt;
        return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: RunSummary) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          运行历史
        </Title>
        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
          刷新
        </Button>
      </div>

      {runs.length === 0 ? (
        <Empty description="暂无运行记录" style={{ padding: 60 }} />
      ) : (
        <Table
          dataSource={runs}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
        />
      )}

      {/* Detail modal */}
      <Modal
        title="运行详情"
        open={!!detailRun}
        onCancel={() => setDetailRun(null)}
        footer={null}
        width={700}
        loading={detailLoading}
      >
        {detailRun && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">{detailRun.workflowId}</Tag>
              <Tag>{detailRun.profileId}</Tag>
              <Tag color={detailRun.status === 'completed' ? 'success' : detailRun.status === 'failed' ? 'error' : 'processing'}>
                {detailRun.status}
              </Tag>
            </Space>

            <Title level={5}>执行日志</Title>
            <Timeline
              items={detailRun.logs.map(log => ({
                color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : 'blue',
                children: (
                  <>
                    <Text>{log.message}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </>
                ),
              }))}
            />

            {detailRun.result != null && (
              <>
                <Title level={5}>执行结果</Title>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 300,
                }}>
                  {JSON.stringify(detailRun.result, null, 2)}
                </pre>
              </>
            )}

            {detailRun.error && (
              <>
                <Title level={5} style={{ color: '#ff4d4f' }}>错误信息</Title>
                <pre style={{
                  background: '#fff2f0',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#ff4d4f',
                }}>
                  {detailRun.error}
                </pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
