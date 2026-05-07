/**
 * ChatPanel — chat with SSE streaming support
 */

import { useRef, useEffect, useState } from 'react';
import {
  Input,
  Button,
  Progress,
  Spin,
  Typography,
  Tag,
  Collapse,
  List,
  Space,
  Badge,
  message,
  Select,
} from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  PictureOutlined,
  CodeOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ChatMessage, RequirementDocument } from '../hooks/useChat';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface ChatPanelProps {
  messages: ChatMessage[];
  document: RequirementDocument | null;
  loading: boolean;
  streaming: boolean;
  streamContent: string;
  completeness: number;
  profileId: string;
  onProfileChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onGenerateDesign: () => void;
  onGenerateCode: () => void;
  designLoading: boolean;
  codeLoading: boolean;
}

export function ChatPanel({
  messages,
  document: doc,
  loading,
  streaming,
  streamContent,
  completeness,
  profileId,
  onProfileChange,
  onSend,
  onStop,
  onGenerateDesign,
  onGenerateCode,
  designLoading,
  codeLoading,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || loading) return;
    setInputValue('');
    onSend(text);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action bar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: '#fff',
      }}>
        <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 16 }} />
        <Select
          value={profileId}
          onChange={onProfileChange}
          size="small"
          style={{ width: 140 }}
          options={[
            { value: 'vue3-admin', label: 'Vue3 Admin' },
            { value: 'react-admin', label: 'React Admin' },
            { value: 'pc-spa', label: 'PC SPA' },
            { value: 'h5-spa', label: 'H5 SPA' },
            { value: 'wechat-miniapp', label: '微信小程序' },
          ]}
        />
        <Progress
          percent={completeness}
          size="small"
          style={{ flex: 1, marginBottom: 0 }}
          status={completeness >= 80 ? 'success' : 'active'}
          format={p => `${p}%`}
        />
        <Button
          type="primary"
          icon={<PictureOutlined />}
          onClick={onGenerateDesign}
          loading={designLoading}
          disabled={completeness < 80}
          size="small"
        >
          设计稿
        </Button>
        <Button
          type="primary"
          icon={<CodeOutlined />}
          onClick={onGenerateCode}
          loading={codeLoading}
          disabled={completeness < 95}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
          size="small"
        >
          代码
        </Button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#f8f9fa' }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <RobotOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <Title level={4} style={{ color: '#999' }}>告诉我你想做什么功能</Title>
            <Paragraph style={{ color: '#bbb' }}>
              例如: "做一个用户管理后台，包含列表、新增、编辑和删除功能"
            </Paragraph>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
            }}
          >
            <div style={{ maxWidth: '80%', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
                </div>
              )}
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#1677ff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <UserOutlined style={{ color: '#666', fontSize: 16 }} />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streaming && streamContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{ maxWidth: '80%', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{
                padding: '10px 16px',
                borderRadius: '16px 16px 16px 4px',
                background: '#fff',
                color: '#333',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}>
                {streamContent}
                <span style={{ animation: 'blink 1s infinite', marginLeft: 2 }}>▊</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && !streamContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{ padding: '10px 16px', borderRadius: '16px', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                <Spin size="small" /> <Text type="secondary">AI 思考中...</Text>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', background: '#fff', display: 'flex', gap: 8 }}>
        <TextArea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="描述你的需求，或回答 AI 的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{ borderRadius: 12 }}
        />
        {loading ? (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={onStop}
            style={{ height: 'auto', borderRadius: 12 }}
          >
            停止
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim()}
            style={{ height: 'auto', borderRadius: 12 }}
          >
            发送
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Document Panel ─────────────────────────────────────────────────────

export function DocumentPanel({ document: doc }: { document: RequirementDocument | null }) {
  if (!doc) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
        <div>开始对话后，需求文档将在这里实时展示</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Title level={5}>📋 {doc.featureName || '未命名功能'}</Title>

      <Progress
        percent={doc.completeness}
        status={doc.completeness >= 80 ? 'success' : 'active'}
        style={{ marginBottom: 16 }}
      />

      <Collapse
        size="small"
        defaultActiveKey={['goal', 'ui', 'pages', 'questions']}
        items={[
          {
            key: 'goal',
            label: '🎯 业务目标',
            children: <Paragraph>{doc.businessGoal || '未定义'}</Paragraph>,
          },
          {
            key: 'ui',
            label: '🎨 UI 组件库',
            children: doc.uiLibrary ? (
              <Tag color="blue">{doc.uiLibrary.name}</Tag>
            ) : (
              <Tag color="default">未选择</Tag>
            ),
          },
          {
            key: 'pages',
            label: `📄 页面 (${doc.pages.length})`,
            children: (
              <List
                size="small"
                dataSource={doc.pages}
                renderItem={page => (
                  <List.Item>
                    <List.Item.Meta
                      title={<><Tag>{page.pageType}</Tag> {page.name}</>}
                      description={page.goal}
                    />
                  </List.Item>
                )}
              />
            ),
          },
          {
            key: 'entities',
            label: `📦 实体 (${doc.entities.length})`,
            children: (
              <List
                size="small"
                dataSource={doc.entities}
                renderItem={entity => (
                  <List.Item>
                    <List.Item.Meta
                      title={entity.name}
                      description={`${entity.fields.length} 个字段`}
                    />
                  </List.Item>
                )}
              />
            ),
          },
          {
            key: 'rules',
            label: `📏 业务规则 (${doc.businessRules.length})`,
            children: (
              <List
                size="small"
                dataSource={doc.businessRules}
                renderItem={rule => <List.Item><Text>• {rule}</Text></List.Item>}
              />
            ),
          },
          {
            key: 'phases',
            label: `🗓️ 阶段 (${doc.phases.length})`,
            children: (
              <List
                size="small"
                dataSource={doc.phases}
                renderItem={phase => (
                  <List.Item>
                    <List.Item.Meta
                      title={<><Tag color="blue">{phase.id}</Tag> {phase.name} <Tag color="orange">{phase.priority}</Tag></>}
                      description={phase.pages.join(', ')}
                    />
                  </List.Item>
                )}
              />
            ),
          },
          ...(doc.openQuestions.length > 0 ? [{
            key: 'questions',
            label: `❓ 待确认 (${doc.openQuestions.length})`,
            children: (
              <List
                size="small"
                dataSource={doc.openQuestions}
                renderItem={q => (
                  <List.Item>
                    <QuestionCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                    <Text>{q}</Text>
                  </List.Item>
                )}
              />
            ),
          }] : []),
        ]}
      />
    </div>
  );
}
