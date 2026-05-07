/**
 * CodePanel — generated code file viewer
 */

import { useState } from 'react';
import { List, Tag, Typography, Empty } from 'antd';
import { CodeOutlined, FileOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface CodeFile {
  path: string;
  kind: string;
  content?: string;
}

export function CodePanel({ files }: { files: CodeFile[] }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (files.length === 0) {
    return (
      <Empty
        image={<CodeOutlined style={{ fontSize: 64, color: '#bbb' }} />}
        description='需求完整度达到 95% 后，点击"代码"按钮生成'
        style={{ padding: 60 }}
      />
    );
  }

  const currentFile = files.find(f => f.path === selectedFile);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* File tree */}
      <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflow: 'auto', padding: 8 }}>
        <div style={{ padding: '8px 8px 4px', fontSize: 12, color: '#888', fontWeight: 600 }}>
          📁 文件 ({files.length})
        </div>
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
                border: 'none',
              }}
            >
              <FileOutlined style={{ marginRight: 6, color: kindColor(file.kind) }} />
              <Tag color={kindColor(file.kind)} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                {file.kind}
              </Tag>
              <Text ellipsis style={{ flex: 1, fontSize: 12 }}>
                {file.path.split('/').pop()}
              </Text>
            </List.Item>
          )}
        />
      </div>

      {/* Code view */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#1e1e1e' }}>
        {currentFile?.content ? (
          <pre style={{
            color: '#d4d4d4',
            fontSize: 13,
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            <code>{currentFile.content}</code>
          </pre>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
            <FileOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>选择文件查看代码</div>
          </div>
        )}
      </div>
    </div>
  );
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
