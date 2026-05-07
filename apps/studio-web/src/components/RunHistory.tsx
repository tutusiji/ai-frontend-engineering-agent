/**
 * RunHistory — workflow run history with approval and artifact viewing
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
  Descriptions,
  Tabs,
  Tree,
  Spin,
} from 'antd';
import {
  HistoryOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  CheckOutlined,
  StopOutlined,
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const API = '/api';

interface RunStage {
  id: string;
  name: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting-approval';
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

interface ApprovalRecord {
  action: 'approved' | 'rejected';
  by: string;
  at: number;
  comment?: string;
}

interface RunSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  error?: string;
  artifactCount: number;
}

interface RunDetail {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  stages: RunStage[];
  approvalHistory: ApprovalRecord[];
  artifacts: string[];
  error?: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  result?: unknown;
}

interface ArtifactItem {
  path: string;
  size: number;
  modified: string;
}

export function RunHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailRun, setDetailRun] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

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
    setArtifacts([]);
    setArtifactContent(null);
    try {
      const res = await fetch(`${API}/runs/${runId}`);
      const data = await res.json();
      setDetailRun(data);

      // Load artifacts
      const artRes = await fetch(`${API}/runs/${runId}/artifacts`);
      if (artRes.ok) {
        const artData = await artRes.json();
        setArtifacts(artData);
      }
    } catch {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadArtifact = async (runId: string, filePath: string) => {
    setArtifactLoading(true);
    setArtifactContent(null);
    try {
      const res = await fetch(`${API}/runs/${runId}/artifacts/${filePath}`);
      if (res.ok) {
        const content = await res.text();
        setArtifactContent(content);
      } else {
        message.error('加载文件失败');
      }
    } catch {
      message.error('加载文件失败');
    } finally {
      setArtifactLoading(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!detailRun) return;
    setApprovalLoading(true);
    try {
      const res = await fetch(`${API}/runs/${detailRun.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ by: 'user' }),
      });
      if (res.ok) {
        message.success(action === 'approve' ? '已批准' : '已拒绝');
        // Refresh detail
        showDetail(detailRun.id);
        refresh();
      } else {
        const err = await res.json();
        message.error(err.error ?? '操作失败');
      }
    } catch {
      message.error('操作失败');
    } finally {
      setApprovalLoading(false);
    }
  };

  const getStageColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'default',
      running: 'processing',
      completed: 'success',
      failed: 'error',
      skipped: 'warning',
      'waiting-approval': 'orange',
    };
    return map[status] ?? 'default';
  };

  const getStageIcon = (status: string) => {
    const map: Record<string, React.ReactNode> = {
      pending: <ClockCircleOutlined />,
      running: <LoadingOutlined />,
      completed: <CheckCircleOutlined />,
      failed: <CloseCircleOutlined />,
      skipped: <ClockCircleOutlined />,
      'waiting-approval': <ClockCircleOutlined />,
    };
    return map[status];
  };

  // Build artifact tree for Tree component
  const buildArtifactTree = (paths: string[]) => {
    const root: Record<string, unknown> = {};
    for (const p of paths) {
      const parts = p.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = null; // leaf node
        } else {
          if (!current[part]) current[part] = {};
          current = current[part] as Record<string, unknown>;
        }
      }
    }

    const convertToTreeData = (obj: Record<string, unknown>, prefix = ''): Array<{ title: string; key: string; icon?: React.ReactNode; children?: Array<unknown> }> => {
      return Object.entries(obj).map(([name, value]) => {
        const key = prefix ? `${prefix}/${name}` : name;
        if (value === null) {
          return { title: name, key, icon: <FileOutlined /> };
        }
        return {
          title: name,
          key,
          icon: <FolderOutlined />,
          children: convertToTreeData(value as Record<string, unknown>, key),
        };
      });
    };

    return convertToTreeData(root);
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
      dataIndex: 'workflowName',
      key: 'workflowName',
      render: (name: string, record: RunSummary) => (
        <Tag color="blue">{name || record.workflowId}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = getStageColor(status);
        const icon = getStageIcon(status);
        return <Tag color={color} icon={icon}>{status}</Tag>;
      },
    },
    {
      title: '产物',
      dataIndex: 'artifactCount',
      key: 'artifactCount',
      render: (count: number) => count > 0 ? <Tag color="green">{count} 文件</Tag> : '-',
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
        if (!record.duration) return '-';
        return record.duration > 1000 ? `${(record.duration / 1000).toFixed(1)}s` : `${record.duration}ms`;
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
        width={800}
        loading={detailLoading}
      >
        {detailRun && (
          <div>
            <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工作流">{detailRun.workflowName || detailRun.workflowId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStageColor(detailRun.status)}>{detailRun.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {detailRun.duration ? `${(detailRun.duration / 1000).toFixed(1)}s` : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Approval buttons */}
            {detailRun.status === 'waiting-approval' && (
              <Space style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 8, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={approvalLoading}
                  onClick={() => handleApproval('approve')}
                >
                  批准
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={approvalLoading}
                  onClick={() => handleApproval('reject')}
                >
                  拒绝
                </Button>
              </Space>
            )}

            <Tabs
              items={[
                {
                  key: 'stages',
                  label: '执行阶段',
                  children: detailRun.stages.length > 0 ? (
                    <Timeline
                      items={detailRun.stages.map(stage => ({
                        color: stage.status === 'completed' ? 'green' : stage.status === 'failed' ? 'red' : stage.status === 'running' ? 'blue' : 'gray',
                        children: (
                          <div>
                            <Space>
                              <Text strong>{stage.name}</Text>
                              <Tag color={getStageColor(stage.status)}>{stage.status}</Tag>
                              {stage.nodeType && <Tag>{stage.nodeType}</Tag>}
                            </Space>
                            {stage.error && (
                              <Paragraph type="danger" style={{ margin: '4px 0 0', fontSize: 12 }}>
                                {stage.error}
                              </Paragraph>
                            )}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty description="无执行阶段数据" />
                  ),
                },
                {
                  key: 'artifacts',
                  label: `产物 (${artifacts.length})`,
                  children: artifacts.length > 0 ? (
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ width: 250, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
                        <Tree
                          treeData={buildArtifactTree(artifacts.map(a => a.path))}
                          defaultExpandAll
                          showIcon
                          onSelect={(keys) => {
                            if (keys.length > 0) {
                              loadArtifact(detailRun.id, keys[0] as string);
                            }
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minHeight: 300 }}>
                        {artifactLoading ? (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                            <Spin />
                          </div>
                        ) : artifactContent ? (
                          <pre style={{
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            padding: 16,
                            borderRadius: 8,
                            fontSize: 12,
                            overflow: 'auto',
                            maxHeight: 400,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}>
                            {artifactContent}
                          </pre>
                        ) : (
                          <Empty description="选择文件查看内容" style={{ padding: 60 }} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <Empty description="暂无产物" />
                  ),
                },
                {
                  key: 'approvals',
                  label: `审批记录 (${detailRun.approvalHistory.length})`,
                  children: detailRun.approvalHistory.length > 0 ? (
                    <Timeline
                      items={detailRun.approvalHistory.map(a => ({
                        color: a.action === 'approved' ? 'green' : 'red',
                        children: (
                          <div>
                            <Space>
                              <Tag color={a.action === 'approved' ? 'success' : 'error'}>
                                {a.action === 'approved' ? '批准' : '拒绝'}
                              </Tag>
                              <Text>{a.by}</Text>
                              <Text type="secondary">{new Date(a.at).toLocaleString()}</Text>
                            </Space>
                            {a.comment && <div style={{ marginTop: 4 }}><Text>{a.comment}</Text></div>}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty description="暂无审批记录" />
                  ),
                },
                {
                  key: 'result',
                  label: '执行结果',
                  children: detailRun.result ? (
                    <pre style={{
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 12,
                      overflow: 'auto',
                      maxHeight: 400,
                    }}>
                      {JSON.stringify(detailRun.result, null, 2)}
                    </pre>
                  ) : (
                    <Empty description="无执行结果" />
                  ),
                },
              ]}
            />

            {detailRun.error && (
              <div style={{ marginTop: 16 }}>
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
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
