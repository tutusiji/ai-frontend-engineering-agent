/**
 * ChatPanel — chat with SSE streaming + Markdown rendering
 */

import { useRef, useEffect, useState, useMemo } from 'react';
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
  message as antdMessage,
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

/** Check if content looks like JSON (requirement doc) */
function isJsonDocument(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null && (
      parsed.completeness !== undefined || parsed.featureName !== undefined || parsed.openQuestions !== undefined
    );
  } catch {
    return false;
  }
}

/** Format a requirement document into readable markdown */
function formatDocAsMarkdown(doc: RequirementDocument): string {
  const parts: string[] = [];

  if (doc.featureName) parts.push(`### 📋 ${doc.featureName}`);
  if (doc.businessGoal) parts.push(`\n**业务目标：** ${doc.businessGoal}`);
  if (doc.uiLibrary) parts.push(`**UI 组件库：** ${doc.uiLibrary.name}`);
  if (doc.pages.length > 0) {
    parts.push(`\n**页面列表：**`);
    doc.pages.forEach(p => parts.push(`- **${p.name}** (${p.pageType}) — ${p.goal || ''}`));
  }
  parts.push(`\n**需求完整度：** ${doc.completeness}%`);

  if (doc.openQuestions.length > 0) {
    parts.push(`\n**❓ 待确认问题：**`);
    doc.openQuestions.forEach((q, i) => parts.push(`${i + 1}. ${q}`));
  }

  if (doc.suggestedNextStep === 'generate-design') {
    parts.push(`\n💡 *需求已足够完整，可以生成设计稿了*`);
  } else if (doc.suggestedNextStep === 'start-coding') {
    parts.push(`\n🚀 *需求已非常完整，可以开始生成代码*`);
  }

  return parts.join('\n');
}

/** Render message content with markdown support */
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // For user messages, show plain text
  if (isUser) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
  }

  // For assistant messages, try to parse as document JSON first
  if (isJsonDocument(content)) {
    try {
      const doc = JSON.parse(content) as RequirementDocument;
      const md = formatDocAsMarkdown(doc);
      return (
        <div className="chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      );
    } catch {
      // fall through to plain markdown
    }
  }

  // Plain text / markdown content
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Action bar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: '#fff',
        flexShrink: 0,
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

      {/* Messages — scrollable area */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 24px',
          background: '#f5f5f5',
        }}
      >
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', padding: '80px 40px', color: '#999' }}>
            <RobotOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <Title level={4} style={{ color: '#999' }}>告诉我你想做什么功能</Title>
            <Paragraph style={{ color: '#bbb', maxWidth: 400, margin: '0 auto' }}>
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
            <div style={{ maxWidth: '85%', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
                </div>
              )}
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? '#1677ff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  lineHeight: 1.7,
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                <MessageContent content={msg.content} isUser={msg.role === 'user'} />
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
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
            <div style={{ maxWidth: '85%', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{
                padding: '10px 16px',
                borderRadius: '12px 12px 12px 4px',
                background: '#fff',
                color: '#333',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                lineHeight: 1.7,
                maxWidth: '100%',
                overflow: 'hidden',
              }}>
                <div className="chat-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
                </div>
                <span style={{ animation: 'blink 1s infinite', marginLeft: 2, color: '#1677ff' }}>▊</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && !streamContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <Spin size="small" /> <Text type="secondary">AI 思考中...</Text>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
        display: 'flex',
        gap: 8,
        flexShrink: 0,
      }}>
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
