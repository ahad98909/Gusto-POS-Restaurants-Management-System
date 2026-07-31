import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Bell, Clock, LogIn, LogOut, CheckCircle, BellRing, X } from 'lucide-react';

const Navbar = () => {
  const { user, attendance, clockIn, clockOut } = useAuth();
  const { connected, notifications, markAllRead, clearNotifications, addListener, removeListener } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  const [time, setTime] = useState(new Date());

  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
      }, 150);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!addListener) return;
    const handleWsEvent = (event) => {
      // Only notify Order Takers when kitchen order is ready to serve
      if (user?.role === 'order_taker' && (event.type === 'ORDER_READY' || (event.type === 'ORDER_STATUS_UPDATE' && event.status === 'ready'))) {
        playChimeSound();
        setActiveToast({
          id: Date.now(),
          title: '🔔 KITCHEN NOTIFICATION',
          message: event.message || `Order #${event.order_id} is ready to serve!`
        });
      }
    };

    addListener(handleWsEvent);
    return () => {
      if (removeListener) removeListener(handleWsEvent);
    };
  }, [addListener, removeListener, user]);



  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationColor = (type) => {
    switch (type) {
      case 'ORDER_READY': return '#10b981'; // Green
      case 'BILL_REQUESTED': return '#f59e0b'; // Amber
      case 'NEW_ORDER': return '#6366f1'; // Indigo
      case 'ORDER_SERVED': return '#06b6d4'; // Cyan
      case 'BILL_PAID': return '#84cc16'; // Lime
      default: return '#94a3b8'; // Slate
    }
  };

  return (
    <>
      {/* Floating Ready Order Toast Notification */}
      {activeToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(12px)',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: '14px',
          boxShadow: '0 12px 35px rgba(16, 185, 129, 0.45), 0 0 20px rgba(16, 185, 129, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BellRing size={20} style={{ animation: 'pulse 1s infinite' }} />
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '14px', letterSpacing: '0.02em' }}>{activeToast.title}</strong>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>{activeToast.message}</span>
          </div>
          <button 
            onClick={() => setActiveToast(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color)',
        position: 'relative',
        zIndex: 100
      }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Welcome back, {user?.name}!
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Real-time Digital Clock */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          <Clock size={14} />
          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
            {time.toLocaleTimeString()}
          </span>
        </div>

        {/* Attendance Controls */}
        {attendance?.clockedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontSize: '13px', 
              color: 'var(--color-primary)',
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <CheckCircle size={14} />
              Clocked In
            </span>
            {!attendance?.clockedOut && (
              <button 
                onClick={() => clockOut()} 
                className="btn btn-danger" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <LogOut size={12} /> Clock Out
              </button>
            )}
          </div>
        ) : (
          <button 
            onClick={() => clockIn()} 
            className="btn btn-primary" 
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <LogIn size={14} /> Clock In Today
          </button>
        )}

        {/* Notifications Popover Trigger */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn-secondary"
            style={{ 
              padding: '10px', 
              borderRadius: '50%', 
              position: 'relative',
              borderColor: unreadCount > 0 ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-color)'
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--color-danger)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 'bold',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="glass-card animate-fade-in" style={{
              position: 'absolute',
              right: 0,
              top: '46px',
              width: '320px',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 1000,
              border: '1px solid var(--border-hover)',
              background: 'rgba(15, 23, 42, 0.95)',
              boxShadow: 'var(--shadow-lg)',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '8px',
                marginBottom: '8px'
              }}>
                <h4 style={{ fontSize: '14px' }}>Notifications</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={markAllRead} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Read All
                  </button>
                  <button 
                    onClick={clearNotifications} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No new notifications.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        background: n.read ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.04)',
                        borderLeft: `3px solid ${getNotificationColor(n.type)}`,
                        fontSize: '12px',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)' }}>{n.text}</div>
                      <div style={{ 
                        color: 'var(--text-muted)', 
                        fontSize: '10px', 
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>{n.type.replace('_', ' ')}</span>
                        <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );

};

export default Navbar;
