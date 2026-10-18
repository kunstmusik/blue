import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBlueShareQueryClient } from './blueshare-query';
import { useBlueShare } from './use-blueshare';
import { BlueShareDialog } from './BlueShareDialog';

export default function BlueShareModal(): React.ReactElement {
  const [client] = useState(createBlueShareQueryClient);
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <BlueShareModalContent />
    </QueryClientProvider>
  );
}

function BlueShareModalContent(): React.ReactElement | null {
  const state = useBlueShare();
  const { open } = state;

  useEffect(() => {
    const handleOpen = () => {
      void open();
    };
    window.addEventListener('blue-open-blue-share', handleOpen);
    return () => window.removeEventListener('blue-open-blue-share', handleOpen);
  }, [open]);

  return <BlueShareDialog state={state} />;
}
