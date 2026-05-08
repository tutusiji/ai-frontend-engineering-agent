/**
 * RunHistory — workflow run history with approval and artifact viewing
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react/table';
import {
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalCloseTrigger,
} from '@heroui/react/modal';
import { Tabs, TabList, Tab, TabPanel } from '@heroui/react/tabs';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { Spinner } from '@heroui/react/spinner';
import { Text } from '@heroui/react/text';
import { EmptyState } from '@heroui/react/empty-state';
import {
  History,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Check,
  Square,
  File,
  Folder,
} from 'lucide-react';

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

// Helper: build a nested tree structure from flat file paths
interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTreeFromPaths(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const p of paths) {
    const parts = p.split('/');
    let currentLevel = root;
    let builtPath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      builtPath = builtPath ? `${builtPath}/${part}` : part;
      const isFile = i === parts.length - 1;
      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = { name: part, path: builtPath, isFile, children: [] };
        currentLevel.push(existing);
      }
      if (!isFile) {
        currentLevel = existing.children;
      }
    }
  }
  return root;
}

// Custom FileTree component
function FileTree({
  nodes,
  onSelect,
  selectedPath,
  depth = 0,
}: {
  nodes: TreeNode[];
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand all on first render
  useEffect(() => {
    const allFolders = new Set<string>();
    const collect = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (!n.isFile) {
          allFolders.add(n.path);
          collect(n.children);
        }
      }
    };
    collect(nodes);
    setExpanded(allFolders);
  }, [nodes]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div>
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm hover:bg-default-100 ${
              selectedPath === node.path ? 'bg-primary-100 text-primary-700 font-medium' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (node.isFile) {
                onSelect(node.path);
              } else {
                toggle(node.path);
              }
            }}
          >
            {!node.isFile ? (
              <span className="text-default-500">
                {expanded.has(node.path) ? '📂' : '📁'}
              </span>
            ) : (
              <File size={14} className="text-default-400" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {!node.isFile && expanded.has(node.path) && (
            <FileTree
              nodes={node.children}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Custom Timeline component
function CustomTimeline({ items }: { items: { color: string; dot?: React.ReactNode; children: React.ReactNode }[] }) {
  return (
    <div className="relative pl-6">
      {items.map((item, idx) => {
        const borderColor =
          item.color === 'green'
            ? 'border-success'
            : item.color === 'red'
            ? 'border-danger'
            : item.color === 'blue'
            ? 'border-primary'
            : 'border-default-300';
        const bgDot =
          item.color === 'green'
            ? 'bg-success'
            : item.color === 'red'
            ? 'bg-danger'
            : item.color === 'blue'
            ? 'bg-primary'
            : 'bg-default-300';
        return (
          <div key={idx} className="relative pb-6 last:pb-0">
            {/* Vertical line */}
            {idx < items.length - 1 && (
              <div className={`absolute left-[-19px] top-4 bottom-0 w-0.5 ${bgDot} opacity-30`} />
            )}
            {/* Dot */}
            <div className={`absolute left-[-23px] top-1.5 w-3 h-3 rounded-full border-2 ${borderColor} bg-background`} />
            {/* Content */}
            <div>{item.children}</div>
          </div>
        );
      })}
    </div>
  );
}

// Empty state placeholder (uses HeroUI EmptyState)
function RunEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-default-400">
      <History size={48} className="mb-3 opacity-40" />
      <Text className="text-default-400">{children}</Text>
    </div>
  );
}

// Descriptions replacement: key-value grid
function DescriptionGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-4 p-4 bg-default-50 rounded-lg">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <Text className="text-xs text-default-400 mb-0.5">{item.label}</Text>
          <Text className="text-sm font-medium">{item.value}</Text>
        </div>
      ))}
    </div>
  );
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
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/runs`);
      const data = await res.json();
      setRuns(data);
    } catch {
      console.error('加载运行历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const showDetail = async (runId: string) => {
    setDetailLoading(true);
    setArtifacts([]);
    setArtifactContent(null);
    setSelectedArtifactPath(null);
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
      console.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadArtifact = async (runId: string, filePath: string) => {
    setArtifactLoading(true);
    setArtifactContent(null);
    setSelectedArtifactPath(filePath);
    try {
      const res = await fetch(`${API}/runs/${runId}/artifacts/${filePath}`);
      if (res.ok) {
        const content = await res.text();
        setArtifactContent(content);
      } else {
        console.error('加载文件失败');
      }
    } catch {
      console.error('加载文件失败');
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
        console.log(action === 'approve' ? '已批准' : '已拒绝');
        // Refresh detail
        showDetail(detailRun.id);
        refresh();
      } else {
        const err = await res.json();
        console.error(err.error ?? '操作失败');
      }
    } catch {
      console.error('操作失败');
    } finally {
      setApprovalLoading(false);
    }
  };

  const getStageChipColor = (status: string): 'default' | 'accent' | 'success' | 'danger' | 'warning' => {
    const map: Record<string, 'default' | 'accent' | 'success' | 'danger' | 'warning'> = {
      pending: 'default',
      running: 'accent',
      completed: 'success',
      failed: 'danger',
      skipped: 'warning',
      'waiting-approval': 'warning',
    };
    return map[status] ?? 'default';
  };

  const getStageIcon = (status: string) => {
    const iconProps = { size: 14 };
    const map: Record<string, React.ReactNode> = {
      pending: <Clock {...iconProps} />,
      running: <Loader2 {...iconProps} className="animate-spin" />,
      completed: <CheckCircle2 {...iconProps} />,
      failed: <XCircle {...iconProps} />,
      skipped: <Clock {...iconProps} />,
      'waiting-approval': <Clock {...iconProps} />,
    };
    return map[status];
  };

  const stageTimelineColor = (status: string) => {
    if (status === 'completed') return 'green';
    if (status === 'failed') return 'red';
    if (status === 'running') return 'blue';
    return 'gray';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  const handleArtifactSelect = useCallback(
    (path: string) => {
      if (detailRun) {
        loadArtifact(detailRun.id, path);
      }
    },
    [detailRun]
  );

  const artifactTree = buildTreeFromPaths(artifacts.map((a) => a.path));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={20} />
          运行历史
        </h3>
        <Button
          variant="outline"
          onPress={refresh}
          isDisabled={loading}
        >
          刷新
        </Button>
      </div>

      {runs.length === 0 ? (
        <EmptyState><span className="text-default-400">暂无运行记录</span></EmptyState>
      ) : (
        <Table aria-label="运行历史表格" variant="primary">
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>工作流</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>产物</TableColumn>
            <TableColumn>开始时间</TableColumn>
            <TableColumn>耗时</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody >
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <code className="text-xs bg-default-100 px-1.5 py-0.5 rounded">
                    {run.id}
                  </code>
                </TableCell>
                <TableCell>
                  <Chip color="accent" variant="soft" size="sm">
                    {run.workflowName || run.workflowId}
                  </Chip>
                </TableCell>
                <TableCell>
<Chip
                        color={getStageChipColor(run.status)}
                        variant="soft"
                        size="sm"
                      >
                        <span className="inline-flex items-center gap-1">{getStageIcon(run.status)} {run.status}</span>
                      </Chip>
                </TableCell>
                <TableCell>
                  {run.artifactCount > 0 ? (
                    <Chip color="success" variant="soft" size="sm">
                      {run.artifactCount} 文件
                    </Chip>
                  ) : (
                    <Text className="text-default-400">-</Text>
                  )}
                </TableCell>
                <TableCell>
                  <Text className="text-sm">{new Date(run.startedAt).toLocaleString()}</Text>
                </TableCell>
                <TableCell>
                  <Text className="text-sm">{formatDuration(run.duration)}</Text>
                </TableCell>
                <TableCell>
<Button
                        size="sm"
                        variant="ghost"
                        onPress={() => showDetail(run.id)}
                      >
                        <Eye size={14} className="inline mr-1" /> 详情
                      </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={!!detailRun}
        onOpenChange={(open) => {
          if (!open) setDetailRun(null);
        }}
        
      >
        <ModalBackdrop />
        <ModalContainer size="lg">
          <ModalDialog>
            <ModalHeader>
              <ModalHeading>运行详情</ModalHeading>
              <ModalCloseTrigger />
            </ModalHeader>
            <ModalBody>
              {detailLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : detailRun ? (
                <div>
                  <DescriptionGrid
                    items={[
                      {
                        label: '工作流',
                        value: detailRun.workflowName || detailRun.workflowId,
                      },
                      {
                        label: '状态',
                        value: (
                          <Chip
                            color={getStageChipColor(detailRun.status)}
                            variant="soft"
                            size="sm"
                          >
                            {detailRun.status}
                          </Chip>
                        ),
                      },
                      {
                        label: '耗时',
                        value: formatDuration(detailRun.duration),
                      },
                    ]}
                  />

                  {/* Approval buttons */}
                  {detailRun.status === 'waiting-approval' && (
                    <div className="flex items-center justify-center gap-3 mb-4 p-3 bg-warning-50 rounded-lg">
<Button
                          variant="primary"
                          isDisabled={approvalLoading}
                          onPress={() => handleApproval('approve')}
                        >
                          <Check size={16} className="inline mr-1" /> 批准
                        </Button>
<Button
                          variant="danger"
                          isDisabled={approvalLoading}
                          onPress={() => handleApproval('reject')}
                        >
                          <Square size={16} className="inline mr-1" /> 拒绝
                        </Button>
                    </div>
                  )}

                  <Tabs aria-label="运行详情标签页" variant="primary">
                    <TabList>
                      <Tab id="stages">执行阶段</Tab>
                      <Tab id="artifacts">产物 ({artifacts.length})</Tab>
                      <Tab id="approvals">审批记录 ({detailRun.approvalHistory.length})</Tab>
                      <Tab id="result">执行结果</Tab>
                    </TabList>
                    <TabPanel id="stages">
                      <div className="py-4">
                        {detailRun.stages.length > 0 ? (
                          <CustomTimeline
                            items={detailRun.stages.map((stage) => ({
                              color: stageTimelineColor(stage.status),
                              children: (
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Text className="font-semibold">{stage.name}</Text>
                                    <Chip
                                      color={getStageChipColor(stage.status)}
                                      variant="soft"
                                      size="sm"
                                    >
                                      {stage.status}
                                    </Chip>
                                    {stage.nodeType && (
                                      <Chip variant="soft" size="sm">
                                        {stage.nodeType}
                                      </Chip>
                                    )}
                                  </div>
                                  {stage.error && (
                                    <pre className="text-xs text-danger mt-1 bg-danger-50 p-2 rounded">
                                      {stage.error}
                                    </pre>
                                  )}
                                </div>
                              ),
                            }))}
                          />
                        ) : (
                          <RunEmptyState>无执行阶段数据</RunEmptyState>
                        )}
                      </div>
                    </TabPanel>

                    <TabPanel id="artifacts">
                      <div className="py-4">
                        {artifacts.length > 0 ? (
                          <div className="flex gap-4">
                            <div className="w-60 min-w-[200px] border-r border-default-200 pr-4 overflow-auto max-h-[400px]">
                              <FileTree
                                nodes={artifactTree}
                                onSelect={handleArtifactSelect}
                                selectedPath={selectedArtifactPath}
                              />
                            </div>
                            <div className="flex-1 min-h-[300px]">
                              {artifactLoading ? (
                                <div className="flex justify-center items-center h-[300px]">
                                  <Spinner size="lg" />
                                </div>
                              ) : artifactContent ? (
                                <pre
                                  className="text-xs p-4 rounded-lg overflow-auto max-h-[400px] whitespace-pre-wrap break-all"
                                  style={{
                                    background: '#1e1e1e',
                                    color: '#d4d4d4',
                                  }}
                                >
                                  {artifactContent}
                                </pre>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-[300px] text-default-400">
                                  <File size={40} className="mb-2 opacity-40" />
                                  <Text className="text-default-400">选择文件查看内容</Text>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <RunEmptyState>暂无产物</RunEmptyState>
                        )}
                      </div>
                    </TabPanel>

                    <TabPanel id="approvals">
                      <div className="py-4">
                        {detailRun.approvalHistory.length > 0 ? (
                          <CustomTimeline
                            items={detailRun.approvalHistory.map((a) => ({
                              color: a.action === 'approved' ? 'green' : 'red',
                              children: (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      color={a.action === 'approved' ? 'success' : 'danger'}
                                      variant="soft"
                                      size="sm"
                                    >
                                      {a.action === 'approved' ? '批准' : '拒绝'}
                                    </Chip>
                                    <Text>{a.by}</Text>
                                    <Text className="text-xs text-default-400">
                                      {new Date(a.at).toLocaleString()}
                                    </Text>
                                  </div>
                                  {a.comment && (
                                    <div className="mt-1">
                                      <Text className="text-sm">{a.comment}</Text>
                                    </div>
                                  )}
                                </div>
                              ),
                            }))}
                          />
                        ) : (
                          <RunEmptyState>暂无审批记录</RunEmptyState>
                        )}
                      </div>
                    </TabPanel>

                    <TabPanel id="result">
                      <div className="py-4">
                        {detailRun.result ? (
                          <pre className="text-xs bg-default-50 p-3 rounded-lg overflow-auto max-h-[400px]">
                            {JSON.stringify(detailRun.result, null, 2)}
                          </pre>
                        ) : (
                          <RunEmptyState>无执行结果</RunEmptyState>
                        )}
                      </div>
                    </TabPanel>
                  </Tabs>

                  {detailRun.error && (
                    <div className="mt-4">
                      <h5 className="text-sm font-bold text-danger mb-2">错误信息</h5>
                      <pre className="text-xs bg-danger-50 text-danger p-3 rounded-lg">
                        {detailRun.error}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </Modal>
    </div>
  );
}
