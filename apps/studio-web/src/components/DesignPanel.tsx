/**
 * DesignPanel — design mockup viewer
 */

import { PictureOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Title } = Typography;

export function DesignPanel({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#999' }}>
        <PictureOutlined style={{ fontSize: 64, marginBottom: 16 }} />
        <Title level={4} style={{ color: '#999' }}>设计稿预览</Title>
        <div>需求完整度达到 80% 后，点击"设计稿"按钮生成</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <iframe
        srcDoc={html}
        style={{ flex: 1, width: '100%', border: 'none' }}
        title="Design Mockup"
      />
    </div>
  );
}
