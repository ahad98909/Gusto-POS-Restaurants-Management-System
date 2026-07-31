import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  ChefHat, 
  UtensilsCrossed, 
  Receipt, 
  Settings, 
  LogOut, 
  Radio, 
  TrendingUp, 
  Users 
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return <Settings size={18} color="#ef4444" />;
      case 'manager': return <Users size={18} color="#06b6d4" />;
      case 'billing': return <Receipt size={18} color="#f59e0b" />;
      case 'chef': return <ChefHat size={18} color="#6366f1" />;
      case 'order_taker': return <UtensilsCrossed size={18} color="#10b981" />;
      default: return <Settings size={18} />;
    }
  };

  const formatRole = (role) => {
    if (!role) return '';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-primary-glow)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--color-primary)'
        }}>
          <ChefHat size={20} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', tracking: '-0.02em' }}>Gusto POS</h2>
      </div>

      <div className="sidebar-nav">
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
            Logged In As
          </div>
          <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '4px', color: '#ffffff' }}>
            {user?.name || 'Loading...'}
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '12px', 
            color: 'var(--text-secondary)',
            marginTop: '6px'
          }}>
            {getRoleIcon(user?.role)}
            <span>{formatRole(user?.role)}</span>
          </div>
        </div>

        {/* Dynamic Nav Items depending on active role */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em', paddingLeft: '16px', marginBottom: '8px' }}>
          Navigation
        </div>

        {user?.role === 'order_taker' && (
          <a href="#" className="sidebar-link active">
            <UtensilsCrossed size={18} />
            <span>Order Entry Panel</span>
          </a>
        )}
        {user?.role === 'chef' && (
          <a href="#" className="sidebar-link active">
            <ChefHat size={18} />
            <span>Kitchen Display System</span>
          </a>
        )}
        {user?.role === 'billing' && (
          <a href="#" className="sidebar-link active">
            <Receipt size={18} />
            <span>Billing Desk</span>
          </a>
        )}
        {user?.role === 'manager' && (
          <a href="#" className="sidebar-link active">
            <Users size={18} />
            <span>Manager Console</span>
          </a>
        )}
        {user?.role === 'owner' && (
          <>
            <a href="#" className="sidebar-link active">
              <TrendingUp size={18} />
              <span>Owner Dashboard</span>
            </a>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        {/* Connection health indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-color)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: '16px'
        }}>
          <Radio size={14} color={connected ? "#10b981" : "#ef4444"} style={{
            animation: connected ? 'pulse 2s infinite' : 'none'
          }} />
          <span>{connected ? "Server Connected" : "Connecting..."}</span>
        </div>

        <button 
          onClick={logout} 
          className="btn btn-secondary" 
          style={{ width: '100%', gap: '8px', color: '#f8fafc', padding: '10px', fontSize: '13px' }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
