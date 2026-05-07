import { useState, useRef, useEffect } from 'react';
import {
  ConfigProvider,
  Layout,
  Menu,
  Input,
  Button,
  Card,
  Progress,
  Tag,
  List,
  Typography,
  Space,
  Divider,
  Select,
  Spin,
  message,
  theme,
  Tabs,
  Badge,
  Collapse,
} from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  CodeOutlined,
  PictureOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const API_BASE = '/api';

interface RequirementDocument {
  featureName: string;
  businessGoal: string;
  userRoles: Array<{ name: string; description: string; permissions: string[] }>;
  uiLibrary: { id: string; name: string; npmPackage: string } | null;
  pages: Array<{
    name: string;
    goal: string;
    pageType: string;
    sections: string[];
    actions: string[];
    fields: Array<{ name: string; type: string; required: boolean; description: string }>;
    interactions: string[];
  }>;
  entities: Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }>;
  businessRules: string[];
  edgeCases: string[];
  nonFunctional: string[];
  phases: Array<{ id: string; name: string; pages: string[]; priority: string }>;
  completeness: number;
  openQuestions: string[];
  suggestedNextStep: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── API ────────────────────────────────────────────────────────────────

async function apiChat(sessionId: string, profileId: string, userMessage: string, mode = 'gather') {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, profileId, userMessage, mode }),
  });
  return res.json();
}

async function apiGenerateDesign(sessionId: string, profileId: string) {
  const res = await fetch(`${API_BASE}/generate/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, profileId }),
  });
  return res.json();
}

async function apiGenerateCode(sessionId: string, profileId: string) {
  const res = await fetch(`${API_BASE}/generate/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, profileId, phaseId: 'P1' }),
  });
  return res.json();
}

// ─── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [profileId, setProfileId] = useState('vue3-admin');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState<RequirementDocument | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [designHtml, setDesignHtml] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ path: string; kind: string; content?: string }>>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sessionId = 'web-session-1';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await apiChat(sessionId, profileId, text);
      if (result.document) {
        setDocument(result.document);
        // Extract AI's open questions as the assistant message
        const doc = result.document as RequirementDocument;
        const aiResponse = formatAiResponse(doc);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      } else if (result.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${result.error}` }]);
      }
    } catch (err) {
      message.error('请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDesign = async () => {
    setDesignLoading(true);
    try {
      const result = await apiGenerateDesign(sessionId, profileId);
      if (result.ok && result.htmlContent) {
        setDesignHtml(result.htmlContent);
        setActiveTab('design');
        message.success('设计稿生成成功');
      } else {
        message.error(result.error || '生成失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setDesignLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    try {
      const result = await apiGenerateCode(sessionId, profileId);
      if (result.ok && result.files) {
        setGeneratedFiles(result.files);
        setActiveTab('code');
        message.success(`代码生成成功，共 ${result.files.length} 个文件`);
      } else {
        message.error(result.error || '生成失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#1677ff', borderRadius: 8 },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
          <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 24, marginRight: 12 }} />
          <Title level={4} style={{ color: '#fff', margin: 0, flex: 1 }}>
            AI Frontend Engineering Agent
          </Title>
          <Select
            value={profileId}
            onChange={setProfileId}
            style={{ width: 160 }}
            options={[
              { value: 'vue3-admin', label: 'Vue3 Admin' },
              { value: 'react-admin', label: 'React Admin' },
              { value: 'pc-spa', label: 'PC SPA' },
              { value: 'h5-spa', label: 'H5 SPA' },
              { value: 'wechat-miniapp', label: '微信小程序' },
            ]}
          />
        </Header>

        <Layout>
          {/* Left sidebar — Document panel */}
          <Sider width={380} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
            <DocumentPanel document={document} />
          </Sider>

          {/* Main content */}
          <Content style={{ display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              tabBarStyle={{ margin: 0, padding: '0 16px' }}
              items={[
                {
                  key: 'chat',
                  label: (
                    <span><RobotOutlined /> 需求对话</span>
                  ),
                  children: (
                    <ChatPanel
                      messages={messages}
                      loading={loading}
                      inputValue={inputValue}
                      onInputChange={setInputValue}
                      onSend={handleSend}
                      chatEndRef={chatEndRef}
                      completeness={document?.completeness ?? 0}
                      onGenerateDesign={handleGenerateDesign}
                      onGenerateCode={handleGenerateCode}
                      designLoading={designLoading}
                      codeLoading={codeLoading}
                    />
                  ),
                },
                {
                  key: 'design',
                  label: (
                    <Badge dot={!!designHtml}>
                      <span><PictureOutlined /> 设计稿</span>
                    </Badge>
                  ),
                  children: <DesignPanel html={designHtml} />,
                },
                {
                  key: 'code',
                  label: (
                    <Badge count={generatedFiles.length} size="small">
                      <span><CodeOutlined /> 代码</span>
                    </Badge>
                  ),
                  children: <CodePanel files={generatedFiles} />,
                },
              ]}
            />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

// ─── Document Panel ─────────────────────────────────────────────────────

function DocumentPanel({ document: doc }: { document: RequirementDocument | null }) {
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

// ─── Chat Panel ─────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  loading,
  inputValue,
  onInputChange,
  onSend,
  chatEndRef,
  completeness,
  onGenerateDesign,
  onGenerateCode,
  designLoading,
  codeLoading,
}: {
  messages: ChatMessage[];
  loading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  completeness: number;
  onGenerateDesign: () => void;
  onGenerateCode: () => void;
  designLoading: boolean;
  codeLoading: boolean;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {/* Action bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Progress percent={completeness} size="small" style={{ flex: 1 }} status={completeness >= 80 ? 'success' : 'active'} />
        <Button
          type="primary"
          icon={<PictureOutlined />}
          onClick={onGenerateDesign}
          loading={designLoading}
          disabled={completeness < 80}
        >
          生成设计稿
        </Button>
        <Button
          type="primary"
          icon={<CodeOutlined />}
          onClick={onGenerateCode}
          loading={codeLoading}
          disabled={completeness < 95}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          生成代码
        </Button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.length === 0 && (
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
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 16px',
                borderRadius: 12,
                background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: msg.role === 'user' ? '#fff' : '#333',
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}>
                {msg.role === 'user' ? '你' : 'AI'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', borderRadius: 12, background: '#f5f5f5' }}>
              <Spin size="small" /> <Text type="secondary">AI 思考中...</Text>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
        <TextArea
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          placeholder="描述你的需求，或回答 AI 的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => {
            if (!e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={onSend}
          loading={loading}
          style={{ height: 'auto' }}
        >
          发送
        </Button>
      </div>
    </div>
  );
}

// ─── Design Panel ───────────────────────────────────────────────────────

function DesignPanel({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#999' }}>
        <PictureOutlined style={{ fontSize: 64, marginBottom: 16 }} />
        <div>需求完整度达到 80% 后，点击"生成设计稿"查看</div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 110px)' }}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Design Mockup"
      />
    </div>
  );
}

// ─── Code Panel ─────────────────────────────────────────────────────────

function CodePanel({ files }: { files: Array<{ path: string; kind: string; content?: string }> }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (files.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#999' }}>
        <CodeOutlined style={{ fontSize: 64, marginBottom: 16 }} />
        <div>需求完整度达到 95% 后，点击"生成代码"查看</div>
      </div>
    );
  }

  const currentFile = files.find(f => f.path === selectedFile);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
      {/* File tree */}
      <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflow: 'auto', padding: 8 }}>
        <List
          size="small"
          dataSource={files}
          renderItem={file => (
            <List.Item
              onClick={() => setSelectedFile(file.path)}
              style={{
                cursor: 'pointer',
                background: selectedFile === file.path ? '#e6f4ff' : undefined,
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              <Tag color={kindColor(file.kind)}>{file.kind}</Tag>
              <Text ellipsis style={{ flex: 1, fontSize: 12 }}>
                {file.path.split('/').pop()}
              </Text>
            </List.Item>
          )}
        />
      </div>

      {/* Code view */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {currentFile?.content ? (
          <pre style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
            overflow: 'auto',
            maxHeight: '100%',
          }}>
            <code>{currentFile.content}</code>
          </pre>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <Text type="secondary">选择文件查看代码</Text>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatAiResponse(doc: RequirementDocument): string {
  const parts: string[] = [];

  if (doc.featureName) parts.push(`功能: ${doc.featureName}`);
  if (doc.uiLibrary) parts.push(`UI 库: ${doc.uiLibrary.name}`);
  if (doc.pages.length > 0) parts.push(`页面: ${doc.pages.map(p => p.name).join(', ')}`);
  parts.push(`完整度: ${doc.completeness}%`);

  if (doc.openQuestions.length > 0) {
    parts.push('\n待确认问题:');
    doc.openQuestions.forEach((q, i) => parts.push(`  ${i + 1}. ${q}`));
  }

  if (doc.suggestedNextStep === 'generate-design') {
    parts.push('\n💡 需求已足够完整，可以生成设计稿了');
  } else if (doc.suggestedNextStep === 'start-coding') {
    parts.push('\n🚀 需求已非常完整，可以开始生成代码');
  }

  return parts.join('\n');
}

function kindColor(kind: string): string {
  const map: Record<string, string> = {
    view: 'blue',
    page: 'blue',
    component: 'green',
    composable: 'purple',
    hook: 'purple',
    api: 'orange',
    test: 'red',
    type: 'cyan',
    style: 'magenta',
  };
  return map[kind] ?? 'default';
}
