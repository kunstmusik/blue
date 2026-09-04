import React from 'react';
import { getSanitizedBsbSwingHtml } from './utils';

interface BsbTextLabelProps {
  text: string;
  plainClassName?: string;
  htmlClassName?: string;
}

export default function BsbTextLabel({
  text,
  plainClassName,
  htmlClassName,
}: BsbTextLabelProps): React.ReactElement {
  const html = getSanitizedBsbSwingHtml(text);
  if (html) {
    return (
      <span
        className={htmlClassName ?? plainClassName}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <span className={plainClassName}>{text}</span>;
}
