import React from "react";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { LLMMessage } from "../types";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: LLMMessage[] | undefined;
  title: string;
}

const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  messages,
  title,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formatMessagesAsMarkdown = (msgs: LLMMessage[] | undefined): string => {
    if (!msgs || msgs.length === 0) return "No prompt data available for this step.";

    return msgs
      .map((msg) => {
        const roleName = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        return `### ${roleName}

${msg.content}`;
      })
      .join("\n\n---\n\n");
  };

  const markdownContent = formatMessagesAsMarkdown(messages);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-full max-h-[90vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Prompt Details: {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400 flex items-center gap-2 text-sm font-medium"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 prose prose-slate dark:prose-invert max-w-none">
          <div className="space-y-8">
            {messages && messages.length > 0 ? (
              messages.map((msg, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      msg.role === 'system' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' :
                      msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {msg.role}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No prompt data available for this step.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
