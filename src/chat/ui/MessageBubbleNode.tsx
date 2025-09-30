/**
 * Message bubble node component for graph visualization
 */

import React, { memo, useState, useCallback } from 'react';
import { MessageNode } from '../models/MessageNode';

export interface MessageBubbleNodeProps {
  message: MessageNode;
  isSelected: boolean;
  onClick: () => void;
  scale: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface MessagePreview {
  text: string;
  hasCode: boolean;
  hasError: boolean;
  wordCount: number;
}

/**
 * Individual message bubble component rendered as SVG
 */
export const MessageBubbleNode: React.FC<MessageBubbleNodeProps> = memo(({
  message,
  isSelected,
  onClick,
  scale,
  className = '',
  style = {}
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate bubble dimensions and content
  const preview = generateMessagePreview(message);
  const dimensions = calculateBubbleDimensions(preview, scale);
  const colors = getMessageColors(message, isSelected, isHovered);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <g
      className={`message-bubble ${className}`}
      style={{ cursor: 'pointer', ...style }}
      transform={`translate(${message.x - dimensions.width / 2}, ${message.y - dimensions.height / 2})`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Selection ring */}
      {isSelected && (
        <rect
          x={-4}
          y={-4}
          width={dimensions.width + 8}
          height={dimensions.height + 8}
          rx={dimensions.borderRadius + 4}
          fill="none"
          stroke="#0969da"
          strokeWidth="2"
          opacity="0.8"
        />
      )}

      {/* Main bubble */}
      <rect
        x="0"
        y="0"
        width={dimensions.width}
        height={dimensions.height}
        rx={dimensions.borderRadius}
        fill={colors.background}
        stroke={colors.border}
        strokeWidth="1"
        filter={isHovered ? 'url(#dropShadow)' : undefined}
      />

      {/* Role indicator */}
      <circle
        cx={message.role === 'user' ? dimensions.width - 12 : 12}
        cy="12"
        r="6"
        fill={colors.roleIndicator}
      />

      {/* Content indicators */}
      <g transform={`translate(8, 24)`}>
        {/* Error indicator */}
        {preview.hasError && (
          <circle
            cx="6"
            cy="6"
            r="4"
            fill="#ef4444"
            opacity="0.8"
          />
        )}

        {/* Code indicator */}
        {preview.hasCode && (
          <rect
            x={preview.hasError ? "16" : "2"}
            y="2"
            width="8"
            height="8"
            rx="2"
            fill="#6366f1"
            opacity="0.8"
          />
        )}
      </g>

      {/* Message text */}
      <text
        x={dimensions.padding}
        y={dimensions.padding + 16}
        fontSize={Math.max(10, 12 / Math.sqrt(scale))}
        fill={colors.text}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {renderMessageText(preview.text, dimensions, scale)}
      </text>

      {/* Message index */}
      <text
        x={dimensions.width - 8}
        y={dimensions.height - 4}
        fontSize={Math.max(8, 10 / Math.sqrt(scale))}
        fill={colors.secondaryText}
        textAnchor="end"
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity="0.7"
      >
        #{message.messageIndex}
      </text>

      {/* Enhanced Tooltip on Hover */}
      {isHovered && (
        <g transform={`translate(${dimensions.width + 10}, -10)`}>
          {/* Tooltip background */}
          <rect
            width="220"
            height="auto"
            rx="6"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="1"
            filter="url(#dropShadow)"
          />

          {/* Tooltip content */}
          <text
            fontSize="10"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#1f2937"
          >
            {/* Message preview */}
            <tspan x="8" dy="14" fontWeight="500">Message Preview</tspan>
            <tspan x="8" dy="14" fill="#4b5563" fontSize="9">
              {message.content.substring(0, 80)}
              {message.content.length > 80 ? '...' : ''}
            </tspan>

            {/* Metadata */}
            <tspan x="8" dy="18" fontSize="9" fill="#6b7280">
              ⏱️ {formatTimestamp(message.startTime)}
            </tspan>
            <tspan x="8" dy="12" fontSize="9" fill="#6b7280">
              🔗 {getConnectionCount(message)} connections
            </tspan>
            {message.metadata.branch && (
              <tspan x="8" dy="12" fontSize="9" fill="#6b7280">
                🌿 Branch: {message.metadata.branch}
              </tspan>
            )}

            {/* Click hint */}
            <tspan x="8" dy="16" fontSize="8" fill="#9ca3af" fontStyle="italic">
              Click to view full message
            </tspan>
          </text>
        </g>
      )}

      {/* Connection points for edges */}
      <circle
        cx={dimensions.width / 2}
        cy="0"
        r="3"
        fill={colors.connectionPoint}
        opacity="0.6"
      />
      <circle
        cx={dimensions.width / 2}
        cy={dimensions.height}
        r="3"
        fill={colors.connectionPoint}
        opacity="0.6"
      />

      {/* SVG definitions for effects */}
      <defs>
        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>
    </g>
  );
});

MessageBubbleNode.displayName = 'MessageBubbleNode';

/**
 * Helper functions
 */
function generateMessagePreview(message: MessageNode): MessagePreview {
  const content = message.content;
  const maxLength = 120;

  // Detect content features
  const hasCode = content.includes('```') || content.includes('`');
  const hasError = message.metadata.contentType === 'error' ||
    content.toLowerCase().includes('error') ||
    content.toLowerCase().includes('exception');

  // Generate preview text
  let text = content;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }

  // Remove code blocks for preview
  text = text.replace(/```[\s\S]*?```/g, '[code]');
  text = text.replace(/`[^`]+`/g, '[code]');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return {
    text,
    hasCode,
    hasError,
    wordCount: content.split(/\s+/).length
  };
}

function calculateBubbleDimensions(preview: MessagePreview, scale: number): {
  width: number;
  height: number;
  padding: number;
  borderRadius: number;
} {
  const baseWidth = 160;
  const baseHeight = 80;
  const padding = 12;

  // Adjust size based on content length
  const textLength = preview.text.length;
  const widthMultiplier = Math.min(Math.max(textLength / 80, 0.8), 2);
  const heightMultiplier = Math.min(Math.max(preview.wordCount / 15, 0.8), 1.5);

  // Scale adjustment
  const scaleAdjustment = Math.max(0.5, Math.min(1.5, 1 / Math.sqrt(scale)));

  return {
    width: Math.round(baseWidth * widthMultiplier * scaleAdjustment),
    height: Math.round(baseHeight * heightMultiplier * scaleAdjustment),
    padding: Math.round(padding * scaleAdjustment),
    borderRadius: Math.round(8 * scaleAdjustment)
  };
}

function getMessageColors(
  message: MessageNode,
  isSelected: boolean,
  isHovered: boolean
): {
  background: string;
  border: string;
  text: string;
  secondaryText: string;
  roleIndicator: string;
  connectionPoint: string;
} {
  const role = message.role;
  const isError = message.metadata.contentType === 'error';

  let background: string;
  let roleIndicator: string;

  // Base colors by role
  if (role === 'user') {
    background = isError ? '#fef2f2' : '#f0f9ff';
    roleIndicator = '#3b82f6';
  } else if (role === 'assistant') {
    background = isError ? '#fef2f2' : '#f0fdf4';
    roleIndicator = '#10b981';
  } else {
    background = '#f8fafc';
    roleIndicator = '#6b7280';
  }

  // Adjust for error state
  if (isError) {
    roleIndicator = '#ef4444';
  }

  // Adjust for selection and hover
  if (isSelected) {
    background = adjustColorBrightness(background, 20);
  } else if (isHovered) {
    background = adjustColorBrightness(background, 10);
  }

  return {
    background,
    border: isSelected ? '#0969da' : isError ? '#f87171' : '#e5e7eb',
    text: '#1f2937',
    secondaryText: '#6b7280',
    roleIndicator,
    connectionPoint: '#9ca3af'
  };
}

function renderMessageText(
  text: string,
  dimensions: { width: number; padding: number },
  scale: number
): React.ReactNode[] {
  const maxCharsPerLine = Math.floor((dimensions.width - dimensions.padding * 2) / 7);
  const lines = wrapText(text, maxCharsPerLine);
  const fontSize = Math.max(10, 12 / Math.sqrt(scale));
  const lineHeight = fontSize * 1.4;

  return lines.slice(0, 4).map((line, index) => (
    <tspan
      key={index}
      x={dimensions.padding}
      dy={index === 0 ? 0 : lineHeight}
    >
      {line}
    </tspan>
  ));
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than max chars, break it
        lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
        break;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function adjustColorBrightness(color: string, amount: number): string {
  // Simple color brightness adjustment
  // This is a basic implementation - in production you'd use a proper color library
  const hex = color.replace('#', '');

  if (hex.length === 3) {
    const expandedHex = hex.split('').map(char => char + char).join('');
    return adjustColorBrightness('#' + expandedHex, amount);
  }

  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));

  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function getConnectionCount(message: MessageNode): number {
  let count = 0;

  // Count parent connection
  if (message.parentMessageId) {
    count++;
  }

  // Count child connections
  if (message.childMessageIds && message.childMessageIds.length > 0) {
    count += message.childMessageIds.length;
  }

  return count;
}