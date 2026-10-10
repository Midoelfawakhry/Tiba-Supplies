import React from 'react';
import { AuthGate } from './components/AuthGate';
import { LiveOperationsBoard } from './components/LiveOperationsBoard';
import { DriverApp } from './components/DriverApp';

export default function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/driver') {
    return <DriverApp />;
  }

  return (
    <AuthGate>
      <LiveOperationsBoard />
    </AuthGate>
  );
}
