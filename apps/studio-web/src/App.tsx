/**
 * App.tsx — Main Studio layout
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │                   Header                          │
 *   ├──────────┬───────────────────────┬───────────────┤
 *   │          │                       │               │
 *   │ Sidebar  │    Main Content       │  Doc Panel    │
 *   │          │  (Chat/Workflow/      │  (when chat)  │
 *   │          │   History/Design/     │               │
 *   │          │   Code)               │               │
 *   │          │                       │               │
 *   └──────────┴───────────────────────┴───────────────┘
 */

import { useState, useEffect } from 'react';
import { ConfigProvider, Layout, Typography, Space, Tag, message, Tabs, Badge } from 'antd';
import {
  ThunderboltOutlined,
  PictureOutlined,
  CodeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import { Sidebar } from './components/Sidebar';
import { ChatPanel, DocumentPanel } from './components/ChatPanel';
import { DesignPanel } from './components/DesignPanel';
import { CodePanel } from './components/CodePanel';
import { WorkflowPanel } from './components/WorkflowPanel';
import { RunHistory } from './components/RunHistory';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const API = '/api';

type NavKey = 'chat' | 'workflows' | 'history';
type ChatTab = 'chat' | 'design' | 'code' | 'document';

export default function App() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    refresh: refreshSessions,
  } = useSessions();

  const [profileId, setProfileId] = useState('vue3-admin');
  const [activeNav, setActiveNav] = useState<NavKey>('chat');
  const [activeChatTab, setActiveChatTab] = useState<ChatTab>('chat');
  const [designHtml, setDesignHtml] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ path: string; kind: string; content?: string }>>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  const chat = useChat(activeSessionId, profileId);

  // Load session data when switching sessions
  useEffect(() => {
    if (activeSessionId) {
      chat.loadSession(activeSessionId);
    }
  }, [activeSessionId]);

  const handleCreateSession = async () => {
    const id = await createSession(profileId);
    if (id) {
      message.success('会话已创建');
    }
  };

  const handleGenerateDesign = async () => {
    if (!activeSessionId) return;
    setDesignLoading(true);
    try {
      const res = await fetch(`${API}/generate/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, profileId }),
      });
      const data = await res.json();
      if (data.ok && data.htmlContent) {
        setDesignHtml(data.htmlContent);
        setActiveChatTab('design');
        message.success('设计稿生成成功');
      } else {
        message.error(data.error || '生成失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setDesignLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!activeSessionId) return;
    setCodeLoading(true);
    try {
      const res = await fetch(`${API}/generate/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, profileId }),
      });
      const data = await res.json();
      if (data.ok && data.files) {
        setGeneratedFiles(data.files);
        setActiveChatTab('code');
        message.success(`代码生成成功，共 ${data.files.length} 个文件`);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const completeness = chat.document?.completeness ?? 0;

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#1677ff', borderRadius: 8 },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        {/* Header */}
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: 'linear-gradient(135deg, #001529, #002140)',
          borderBottom: '1px solid #003a70',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff, #4096ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <ThunderboltOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <Title level={4} style={{ color: '#fff', margin: 0, flex: 1 }}>
            AI Frontend Engineering Agent
          </Title>
          <Space>
            <Tag color="blue">{profileId}</Tag>
            {activeSession && (
              <Tag color="green">{activeSession.name}</Tag>
            )}
          </Space>
        </Header>

        <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          {/* Sidebar */}
          <Sider width={280} style={{ background: '#fafafa', overflow: 'auto', height: '100%' }}>
            <Sidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              activeNav={activeNav}
              onSelectSession={(id) => {
                setActiveSessionId(id);
                setActiveNav('chat');
              }}
              onCreateSession={handleCreateSession}
              onDeleteSession={deleteSession}
              onRenameSession={renameSession}
              onNavigate={setActiveNav}
            />
          </Sider>

          {/* Main content */}
          <Content style={{ display: 'flex', flexDirection: 'column', background: '#fff', height: '100%', overflow: 'hidden' }}>
            {activeNav === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs
                  activeKey={activeChatTab}
                  onChange={k => setActiveChatTab(k as ChatTab)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  tabBarStyle={{ margin: 0, padding: '0 16px', background: '#fff', flexShrink: 0 }}
                  items={[
                    {
                      key: 'chat',
                      label: <span><ThunderboltOutlined /> 需求对话</span>,
                      children: (
                        <ChatPanel
                          messages={chat.messages}
                          document={chat.document}
                          loading={chat.loading}
                          streaming={chat.streaming}
                          streamContent={chat.streamContent}
                          completeness={completeness}
                          profileId={profileId}
                          onProfileChange={setProfileId}
                          onSend={chat.send}
                          onStop={chat.stop}
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
                    {
                      key: 'document',
                      label: (
                        <Badge dot={!!chat.document}>
                          <span><FileTextOutlined /> 文档</span>
                        </Badge>
                      ),
                      children: (
                        <div style={{ overflow: 'auto', height: 'calc(100vh - 150px)' }}>
                          <DocumentPanel document={chat.document} />
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {activeNav === 'workflows' && (
              <WorkflowPanel profileId={profileId} />
            )}

            {activeNav === 'history' && (
              <RunHistory />
            )}
          </Content>

          {/* Right sidebar — Document panel (only in chat mode) */}
          {activeNav === 'chat' && (
            <Sider
              width={360}
              style={{
                background: '#fff',
                borderLeft: '1px solid #f0f0f0',
                overflow: 'auto',
                height: '100%',
              }}
            >
              <DocumentPanel document={chat.document} />
            </Sider>
          )}
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
