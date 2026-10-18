// Test-only entry point: the production dialog and preload, with a disposable Query client.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from '../src/renderer/components/blueshare/blueshare-query';
import { BlueShareDialog } from '../src/renderer/components/blueshare/BlueShareDialog';
import { useBlueShare } from '../src/renderer/components/blueshare/use-blueshare';
import '../src/renderer/styles/index.css';

function AcceptanceDialog() {
  const state = useBlueShare();
  return (
    <>
      <button id="open-blueshare" onClick={() => void state.open()}>
        Open Blue Share
      </button>
      <BlueShareDialog state={state} />
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={createBlueShareQueryClient()}>
    <AcceptanceDialog />
  </QueryClientProvider>,
);
