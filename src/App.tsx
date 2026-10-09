import React from 'react';
import { AuthGate } from './components/AuthGate';
import { LiveOperationsBoard } from './components/LiveOperationsBoard';

export default function App() {
  return (
    <AuthGate>
      <LiveOperationsBoard />
    </AuthGate>
  );
}
