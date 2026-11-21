import React, { useMemo } from 'react';
import { sanitizeHtml } from '../utils/htmlSanitizer';

interface SafeHtmlProps {
  html: string;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'strong' | 'section' | 'article';
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLElement>;
  title?: string;
}

export function SafeHtml({
  html,
  as: Tag = 'div',
  className,
  style,
  onClick,
  title,
}: SafeHtmlProps) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <Tag
      className={className}
      style={style}
      onClick={onClick}
      title={title}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
