import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Play, Check, ChefHat, AlertTriangle } from 'lucide-react';

// Animated Clock Timer & Progress Indicator Widget
const AnimatedOrderTimer = ({ timestamp }) => {
  const diffMs = new Date() - new Date(timestamp);
  const diffMins = Math.floor(diffMs / 60000);
  const maxLimitMins = 40;
  
  // Percent towards 40m limit (capped at 100%)
  const percentage = Math.min(100, Math.max(0, (diffMins / maxLimitMins) * 100));
  const rotationDegrees = Math.min(360, Math.floor((diffMins / maxLimitMins) * 360));
  const isOverdue = diffMins >= maxLimitMins;

  // Format string: e.g. "Just now", "12m", "35m", "1h 15m", "5h 0m"
  const formatElapsed = () => {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m ago`;
  };

  const getTimerColor = () => {
    if (diffMins >= 40) return 'var(--color-danger)';
    if (diffMins >= 25) return 'var(--color-warning)';
    return 'var(--color-primary)';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Animated Rotating Clock Face & Progress Ring */}
      <div 
        style={{
          position: 'relative',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title={`Elapsed: ${formatElapsed()} (40m limit)`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
          {/* Background Ring */}
          <circle 
            cx="12" 
            cy="12" 
            r="9" 
            fill="none" 
            stroke="rgba(255,255,255,0.15)" 
            strokeWidth="2.5" 
          />
          {/* Circular Progress Ring */}
          <circle 
            cx="12" 
            cy="12" 
            r="9" 
            fill="none" 
            stroke={getTimerColor()} 
            strokeWidth="2.5" 
            strokeDasharray="56.5" 
            strokeDashoffset={56.5 - (56.5 * percentage) / 100}
            strokeLinecap="round"
            transform="rotate(-90 12 12)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          {/* Clock Hand moving according to delay time */}
          <line
            x1="12"
            y1="12"
            x2="12"
            y2="5"
            stroke={getTimerColor()}
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${rotationDegrees} 12 12)`}
            style={{
              transition: 'transform 0.5s ease',
              animation: isOverdue ? 'pulse 2s infinite' : 'none'
            }}
          />
        </svg>
      </div>

      <span style={{ 
        fontSize: '11px', 
        fontWeight: isOverdue ? 'bold' : '600', 
        color: getTimerColor(),
        letterSpacing: '0.2px'
      }}>
        {formatElapsed()}
      </span>
    </div>
  );
};

const ChefDashboard = () => {
  const { authFetch } = useAuth();
  const { addListener, removeListener } = useSocket();
  const [orders, setOrders] = useState([]);
  const [, setTick] = useState(0);

  const fetchOrders = async () => {
    try {
      const res = await authFetch('/api/orders');
      const data = await res.json();
      setOrders(data.filter(o => o.status !== 'billed'));
    } catch (err) {
      console.error("Error fetching kitchen queue:", err);
    }
  };

  useEffect(() => {
    fetchOrders();

    const handleWsEvent = (event) => {
      if (event.type === 'NEW_ORDER' || event.type === 'ORDER_STATUS_UPDATE' || event.type === 'BILL_PAID') {
        fetchOrders();
      }
    };

    addListener(handleWsEvent);

    // Live update clocks every 15 seconds
    const timerInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000);

    return () => {
      removeListener(handleWsEvent);
      clearInterval(timerInterval);
    };
  }, []);

  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {
      console.error("Error updating kitchen status:", err);
    }
  };

  const isDelayed = (timestamp) => {
    const diffMs = new Date() - new Date(timestamp);
    return diffMs >= 2400000; // 40 minutes in ms
  };

  const getUrgencyBorder = (timestamp) => {
    const diffMs = new Date() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins >= 40) return '2px solid var(--color-danger)';
    if (diffMins >= 25) return '2px solid var(--color-warning)';
    return '1px solid var(--border-color)';
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready' || o.status === 'served');
  const delayedOrdersCount = orders.filter(o => (o.status === 'pending' || o.status === 'preparing') && isDelayed(o.created_at)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
      
      {/* Telemetry Info */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '8px',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          color: 'var(--color-secondary)'
        }}>
          <ChefHat size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '18px' }}>Kitchen Display Queue (40m Max Limit)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Active: {orders.length} | Pending: {pendingOrders.length} | Cooking: {preparingOrders.length} | 
            <span style={{ color: delayedOrdersCount > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: delayedOrdersCount > 0 ? 'bold' : 'normal', marginLeft: '6px' }}>
              Delayed (&gt;40m): {delayedOrdersCount}
            </span>
          </p>
        </div>
      </div>

      {/* Kanban Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        
        {/* Column 1: Pending Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'rgba(245, 158, 11, 0.15)',
            borderLeft: '4px solid var(--color-warning)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--color-warning)' }}>New Incoming ({pendingOrders.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>
            {pendingOrders.map(order => (
              <div 
                key={order.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  border: getUrgencyBorder(order.created_at),
                  backgroundColor: isDelayed(order.created_at) ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Order #{order.id}</span>
                  <AnimatedOrderTimer timestamp={order.created_at} />
                </div>

                {isDelayed(order.created_at) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: '4px',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    <AlertTriangle size={13} />
                    <span>🔴 DELAYED (&gt;40m Limit)</span>
                  </div>
                )}

                <div style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  borderTop: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  padding: '8px 0'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Ordered Items</div>
                  {order.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>• {item.menu_item.name}</span>
                      <strong style={{ color: 'var(--color-primary)' }}>x{item.quantity}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Table: <strong>{order.table ? order.table.table_number : 'Takeaway'}</strong></span>
                  <span>Server: <strong style={{ color: 'var(--color-primary-glow)' }}>{order.user ? order.user.name : 'System'}</strong></span>
                </div>

                {order.items.some(i => i.notes) && (
                  <div style={{ 
                    padding: '8px', 
                    backgroundColor: 'rgba(245, 158, 11, 0.05)', 
                    border: '1px dashed rgba(245,158,11,0.2)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--color-warning)'
                  }}>
                    <strong>Notes:</strong> {order.items.map(i => i.notes).filter(Boolean).join(', ')}
                  </div>
                )}

                <button 
                  onClick={() => handleUpdateStatus(order.id, 'preparing')}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '12px', gap: '6px', background: 'var(--color-warning)' }}
                >
                  <Play size={12} /> Start Preparing
                </button>
              </div>
            ))}
            {pendingOrders.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                No incoming orders.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Preparing Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'rgba(99, 102, 241, 0.15)',
            borderLeft: '4px solid var(--color-secondary)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>Cooking In Progress ({preparingOrders.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>
            {preparingOrders.map(order => (
              <div 
                key={order.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  border: getUrgencyBorder(order.created_at),
                  backgroundColor: isDelayed(order.created_at) ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Order #{order.id}</span>
                  <AnimatedOrderTimer timestamp={order.created_at} />
                </div>

                {isDelayed(order.created_at) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: '4px',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    <AlertTriangle size={13} />
                    <span>🔴 DELAYED (&gt;40m Limit)</span>
                  </div>
                )}

                <div style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  borderTop: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  padding: '8px 0'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Ordered Items</div>
                  {order.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>• {item.menu_item.name}</span>
                      <strong style={{ color: 'var(--color-primary)' }}>x{item.quantity}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Table: <strong>{order.table ? order.table.table_number : 'Takeaway'}</strong></span>
                  <span>Server: <strong style={{ color: 'var(--color-primary-glow)' }}>{order.user ? order.user.name : 'System'}</strong></span>
                </div>

                {order.items.some(i => i.notes) && (
                  <div style={{ 
                    padding: '8px', 
                    backgroundColor: 'rgba(255,255,255,0.03)', 
                    border: '1px dashed var(--border-color)',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    <strong>Notes:</strong> {order.items.map(i => i.notes).filter(Boolean).join(', ')}
                  </div>
                )}

                <button 
                  onClick={() => handleUpdateStatus(order.id, 'ready')}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '12px', gap: '6px', background: 'var(--color-primary)' }}
                >
                  <Check size={12} /> Ready to Serve
                </button>
              </div>
            ))}
            {preparingOrders.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                No active cooking.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Ready/Served Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'rgba(16, 185, 129, 0.15)',
            borderLeft: '4px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--color-primary)' }}>Done / Ready ({readyOrders.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>
            {readyOrders.map(order => (
              <div 
                key={order.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  borderColor: 'rgba(16, 185, 129, 0.2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Order #{order.id}</span>
                  <span className={`badge badge-${order.status}`} style={{ fontSize: '10px' }}>
                    {order.status === 'served' ? 'Served' : 'Ready'}
                  </span>
                </div>
                
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '8px'
                }}>
                  {order.items.map(item => (
                    <div key={item.id}>• {item.menu_item.name} x{item.quantity}</div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Table: {order.table ? order.table.table_number : 'Takeaway'}</span>
                  <span>Server: {order.user ? order.user.name : 'System'}</span>
                </div>
              </div>
            ))}
            {readyOrders.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                No completed orders in this window.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChefDashboard;
