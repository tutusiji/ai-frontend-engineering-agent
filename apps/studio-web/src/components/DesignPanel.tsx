/**
 * DesignPanel — design mockup viewer
 */

import { Image } from 'lucide-react';

export function DesignPanel({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-gray-400">
        <Image className="w-16 h-16 mb-4" />
        <h4 className="text-lg font-semibold text-gray-400 mb-2">设计稿预览</h4>
        <div>需求完整度达到 80% 后，点击"设计稿"按钮生成</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <iframe
        srcDoc={html}
        className="flex-1 w-full border-none"
        title="Design Mockup"
      />
    </div>
  );
}
