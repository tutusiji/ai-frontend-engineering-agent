/**
 * CodePanel — generated code file viewer with syntax highlighting
 */

import { useState, useEffect, useRef } from 'react';
import { Chip } from '@heroui/react/chip';
import { Text } from '@heroui/react/text';
import { Code, File } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/themes/prism-tomorrow.css';

interface CodeFile {
  path: string;
  kind: string;
  content?: string;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'jsx',
    jsx: 'jsx',
    css: 'css',
    scss: 'css',
    less: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    vue: 'html',
    html: 'html',
  };
  return map[ext] ?? 'typescript';
}

function kindChipColor(kind: string): "accent" | "success" | "default" | "warning" | "danger" {
  const map: Record<string, "accent" | "success" | "default" | "warning" | "danger"> = {
    view: 'accent',
    page: 'accent',
    component: 'success',
    composable: 'default',
    hook: 'default',
    api: 'warning',
    test: 'danger',
    type: 'accent',
    style: 'default',
  };
  return map[kind] ?? 'default';
}

function HighlightedCode({ code, language }: { code: string; language: string }) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  return (
    <pre className="m-0 p-4 bg-[#1e1e1e] text-[13px] leading-relaxed">
      <code ref={codeRef} className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
}

export function CodePanel({ files }: { files: CodeFile[] }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16">
        <Code size={64} className="text-default-400" />
        <Text className="text-default-500">
          {'需求完整度达到 95% 后，点击"代码"按钮生成'}
        </Text>
      </div>
    );
  }

  const currentFile = files.find((f) => f.path === selectedFile);

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-[280px] border-r border-divider overflow-auto p-2">
        <div className="px-2 pt-2 pb-1 text-xs text-default-500 font-semibold">
          📁 文件 ({files.length})
        </div>
        <div className="flex flex-col gap-0.5">
          {files.map((file) => (
            <div
              key={file.path}
              onClick={() => setSelectedFile(file.path)}
              className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md transition-colors ${
                selectedFile === file.path
                  ? 'bg-primary-100'
                  : 'hover:bg-default-100'
              }`}
            >
              <File size={14} className={`text-${kindChipColor(file.kind)}`} />
              <Chip
                size="sm"
                variant="soft"
                color={kindChipColor(file.kind)}
                className="text-[10px] h-4 min-w-0 px-1"
              >
                {file.kind}
              </Chip>
              <Text className="text-xs truncate flex-1">
                {file.path.split('/').pop()}
              </Text>
            </div>
          ))}
        </div>
      </div>

      {/* Code view */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        {currentFile?.content ? (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#333]">
              <File size={14} className="text-[#569cd6]" />
              <Text className="text-[#d4d4d4] text-xs">
                {currentFile.path}
              </Text>
              <Chip
                size="sm"
                variant="soft"
                className="ml-auto text-[10px] h-4 min-w-0 px-1"
              >
                {getLanguage(currentFile.path)}
              </Chip>
            </div>
            <HighlightedCode
              code={currentFile.content}
              language={getLanguage(currentFile.path)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-default-500 gap-4">
            <File size={48} />
            <div>选择文件查看代码</div>
          </div>
        )}
      </div>
    </div>
  );
}
