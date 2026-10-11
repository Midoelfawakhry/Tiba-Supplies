import React from 'react';
import { AuthGate } from './components/AuthGate';
import { LiveOperationsBoard } from './components/LiveOperationsBoard';
import { DriverApp } from './components/DriverApp';
import { BranchOfficeApp } from './components/BranchOfficeApp';

const driverBuild = import.meta.env.VITE_APP_MODE === 'driver';
const branchBuild = import.meta.env.VITE_APP_MODE === 'branch';
const currentPath = window.location.pathname.replace(/\/+$/, '');
const driverPath = currentPath === '/driver';
const branchPath = currentPath === '/branch';

export default function App() {
  if (driverBuild || driverPath) return <DriverApp />;
  if (branchBuild || branchPath) return <AuthGate loginTitle="دخول موظف مكتب رأس سدر"><BranchOfficeApp /></AuthGate>;
  return <AuthGate><LiveOperationsBoard /></AuthGate>;
}
