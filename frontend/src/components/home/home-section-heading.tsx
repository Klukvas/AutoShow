import type { ReactNode } from 'react';

export function HomeSectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="home-section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
