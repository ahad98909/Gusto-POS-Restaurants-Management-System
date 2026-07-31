import React from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import OrderTakerDashboard from './dashboards/OrderTakerDashboard';
import ChefDashboard from './dashboards/ChefDashboard';
import BillingDashboard from './dashboards/BillingDashboard';
import ManagerDashboard from './dashboards/ManagerDashboard';
import OwnerDashboard from './dashboards/OwnerDashboard';

const Dashboard = () => {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.role) {
      case 'order_taker':
        return <OrderTakerDashboard />;
      case 'chef':
        return <ChefDashboard />;
      case 'billing':
        return <BillingDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'owner':
        return <OwnerDashboard />;
      default:
        return (
          <div className="glass-card text-center" style={{ padding: '40px', marginTop: '20px' }}>
            <h2>Access Error</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Your account role "{user?.role}" is not recognized by the POS system.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {renderDashboard()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
