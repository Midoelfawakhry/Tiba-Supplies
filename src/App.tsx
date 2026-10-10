import React from 'react';
import { AuthGate } from './components/AuthGate';
import { LiveOperationsBoard } from './components/LiveOperationsBoard';
import { DriverApp } from './components/DriverApp';

const driverBuild = import.meta.env.VITE_APP_MODE === 'driver';
const driverPath = window.location.pathname.replace(/\/+$/, '') === '/driver';

export default function App() {
  if (driverBuild || driverPath) {
    return <DriverApp />;
  }

  return (
    <AuthGate>
      <LiveOperationsBoard />
    </AuthGate>
  );
}
