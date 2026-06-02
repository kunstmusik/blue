import React, { useState } from 'react';
import LiveSpaceTab from './blue-live/LiveSpaceTab';
import LiveCodeTab from './blue-live/LiveCodeTab';
import OptionsTab from './blue-live/OptionsTab';

type BlueLiveTab = 'liveSpace' | 'liveCode' | 'options';

const tabs: { id: BlueLiveTab; label: string }[] = [
  { id: 'liveSpace', label: 'Live Space' },
  { id: 'liveCode', label: 'Live Code' },
  { id: 'options', label: 'Options' },
];

export default function BlueLivePanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<BlueLiveTab>('liveSpace');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-app-border)',
        background: 'var(--color-app-bg)',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--color-app-surface-raised)' : undefined,
              color: activeTab === tab.id ? 'var(--color-app-text-strong)' : 'var(--color-app-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              borderBottom: activeTab === tab.id ? '2px solid var(--color-app-focus)' : '2px solid var(--color-app-bg)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {activeTab === 'liveSpace' && <LiveSpaceTab />}
        {activeTab === 'liveCode' && <LiveCodeTab />}
        {activeTab === 'options' && <OptionsTab />}
      </div>
    </div>
  );
}
