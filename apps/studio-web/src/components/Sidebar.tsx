/**
 * Sidebar — session list + management + navigation
 */

import { useState } from 'react';
import {
  Button,
  List,
  Tag,
  Progress,
  Popconfirm,
  Input,
  Tooltip,
  Typography,
  Space,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { Session } from '../hooks/useSessions';

const { Text } = Typography;

type NavKey = 'chat' | 'workflows' | 'history';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  activeNav: NavKey;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onNavigate: (key: NavKey) => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  activeNav,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onNavigate,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (s: Session) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const confirmEdit = () => {
    if (editingId && editName.trim()) {
      onRenameSession(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={{ width: 280, background: '#fafafa', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Navigation */}
      <div style={{ padding: '12px 12px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Button
            block
            type={activeNav === 'chat' ? 'primary' : 'text'}
            icon={<MessageOutlined />}
            onClick={() => onNavigate('chat')}
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
          >
            需求对话
          </Button>
          <Button
            block
            type={activeNav === 'workflows' ? 'primary' : 'text'}
            icon={<AppstoreOutlined />}
            onClick={() => onNavigate('workflows')}
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
          >
            工作流
          </Button>
          <Button
            block
            type={activeNav === 'history' ? 'primary' : 'text'}
            icon={<HistoryOutlined />}
            onClick={() => onNavigate('history')}
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
          >
            运行历史
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Session list header */}
      {activeNav === 'chat' && (
        <>
          <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 12, color: '#888' }}>会话列表</Text>
            <Tooltip title="新建会话">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={onCreateSession} />
            </Tooltip>
          </div>

          {/* Sessions */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
            <List
              size="small"
              dataSource={sessions}
              renderItem={s => (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  style={{
                    padding: '8px 10px',
                    marginBottom: 4,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: activeSessionId === s.id ? '#e6f4ff' : '#fff',
                    border: activeSessionId === s.id ? '1px solid #91caff' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editingId === s.id ? (
                      <Input
                        size="small"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onPressEnter={confirmEdit}
                        onBlur={confirmEdit}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        suffix={
                          <Space size={2}>
                            <CheckOutlined style={{ color: '#52c41a', cursor: 'pointer' }} onClick={confirmEdit} />
                            <CloseOutlined style={{ color: '#999', cursor: 'pointer' }} onClick={() => setEditingId(null)} />
                          </Space>
                        }
                      />
                    ) : (
                      <>
                        <Text strong style={{ fontSize: 13, flex: 1 }} ellipsis>{s.name}</Text>
                        <Space size={2}>
                          <Tooltip title="重命名">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined style={{ fontSize: 11 }} />}
                              onClick={e => { e.stopPropagation(); startEdit(s); }}
                            />
                          </Tooltip>
                          <Popconfirm title="确认删除?" onConfirm={() => onDeleteSession(s.id)} onCancel={e => e?.stopPropagation()}>
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                              onClick={e => e.stopPropagation()}
                            />
                          </Popconfirm>
                        </Space>
                      </>
                    )}
                  </div>

                  {s.featureName && (
                    <Text style={{ fontSize: 11, color: '#666' }} ellipsis>{s.featureName}</Text>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Progress
                      percent={s.completeness}
                      size="small"
                      style={{ flex: 1, marginBottom: 0 }}
                      strokeColor={s.completeness >= 80 ? '#52c41a' : '#1677ff'}
                    />
                    <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                      {s.messageCount}条
                    </Tag>
                  </div>
                </div>
              )}
            />

            {sessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                <MessageOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>暂无会话</div>
                <Button type="link" size="small" onClick={onCreateSession}>创建第一个</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
