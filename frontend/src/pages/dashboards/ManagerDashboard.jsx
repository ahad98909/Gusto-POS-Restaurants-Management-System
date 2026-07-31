import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  Map, 
  Play, 
  Check, 
  UserCheck 
} from 'lucide-react';

const ManagerDashboard = () => {
  const { authFetch } = useAuth();
  const { addListener, removeListener } = useSocket();

  // Metrics & State
  const [metrics, setMetrics] = useState({
    total_tables: 0,
    empty_tables: 0,
    occupied_tables: 0,
    reserved_tables: 0,
    active_orders_count: 0,
    delayed_orders_count: 0,
    present_staff_count: 0
  });

  const [tables, setTables] = useState([]);
  const [delayedOrders, setDelayedOrders] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [editingTable, setEditingTable] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const fetchDashboardData = async () => {
    try {
      // Metrics
      const metRes = await authFetch('/api/manager/metrics');
      const metData = await metRes.json();
      setMetrics(metData);

      // Live Tables
      const tblRes = await authFetch('/api/tables');
      const tblData = await tblRes.json();
      setTables(tblData);

      // Delayed Orders
      const dlyRes = await authFetch('/api/manager/delayed-orders');
      const dlyData = await dlyRes.json();
      setDelayedOrders(dlyData);

      // Attendance
      const attRes = await authFetch('/api/manager/attendance');
      const attData = await attRes.json();
      setAttendanceLogs(attData);
    } catch (err) {
      console.error("Error fetching manager metrics:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleWsEvent = (event) => {
      if (event.type === 'NEW_ORDER' || event.type === 'ORDER_STATUS_UPDATE' || event.type === 'TABLE_UPDATE' || event.type === 'BILL_PAID') {
        fetchDashboardData();
      }
    };

    addListener(handleWsEvent);
    return () => removeListener(handleWsEvent);
  }, []);

  const handleUpdateTableStatus = async () => {
    if (!editingTable || !newStatus) return;
    try {
      const res = await authFetch(`/api/tables/${editingTable.id}/status?table_status=${newStatus}`, {
        method: 'PUT'
      });
      if (res.ok) {
        setEditingTable(null);
        setNewStatus('');
        fetchDashboardData();
        alert("Table status updated!");
      }
    } catch (err) {
      alert("Failed to modify table status.");
    }
  };

  const getTableColor = (status) => {
    switch (status) {
      case 'occupied': return 'rgba(239, 68, 68, 0.15)'; // Rose/Red
      case 'reserved': return 'rgba(245, 158, 11, 0.15)'; // Amber/Orange
      case 'empty': return 'rgba(16, 185, 129, 0.15)'; // Emerald/Green
      default: return 'var(--border-color)';
    }
  };

  const getTableBorder = (status) => {
    switch (status) {
      case 'occupied': return '1px solid var(--color-danger)';
      case 'reserved': return '1px solid var(--color-warning)';
      case 'empty': return '1px solid var(--color-primary)';
      default: return '1px solid var(--border-color)';
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
      
      {/* Metrics Row */}
      <div className="dashboard-grid">
        
        {/* Metric 1 */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Dining Room Status</span>
            <h3 style={{ fontSize: '26px', marginTop: '4px' }}>
              {metrics.occupied_tables}/{metrics.total_tables} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>Occupied</span>
            </h3>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-info)' }}>
            <Map size={24} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Active Orders</span>
            <h3 style={{ fontSize: '26px', marginTop: '4px' }}>{metrics.active_orders_count}</h3>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-secondary)' }}>
            <Clock size={24} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          border: metrics.delayed_orders_count > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
          background: metrics.delayed_orders_count > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)'
        }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>{"Delayed Orders (>40m)"}</span>
            <h3 style={{ fontSize: '26px', marginTop: '4px', color: metrics.delayed_orders_count > 0 ? 'var(--color-danger)' : '#ffffff' }}>
              {metrics.delayed_orders_count}
            </h3>
          </div>
          <div style={{ 
            padding: '8px', 
            borderRadius: '8px', 
            background: metrics.delayed_orders_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)', 
            color: metrics.delayed_orders_count > 0 ? 'var(--color-danger)' : 'var(--text-muted)',
            animation: metrics.delayed_orders_count > 0 ? 'pulse 2s infinite' : 'none'
          }}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Staff Attendance</span>
            <h3 style={{ fontSize: '26px', marginTop: '4px' }}>{metrics.present_staff_count}</h3>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)' }}>
            <Users size={24} />
          </div>
        </div>

      </div>

      {/* Main Grid: Tables and Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
        
        {/* Left: Tables Floor layout */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={16} color="var(--color-info)" />
            Restaurant Floor Layout
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '16px'
          }}>
            {tables.map(table => (
              <div 
                key={table.id}
                onClick={() => {
                  setEditingTable(table);
                  setNewStatus(table.status);
                }}
                className="glass-card glass-card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  cursor: 'pointer',
                  backgroundColor: getTableColor(table.status),
                  border: getTableBorder(table.status),
                  textAlign: 'center'
                }}
              >
                <strong style={{ fontSize: '18px' }}>{table.table_number}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {table.capacity} Seats
                </span>
                <span className={`badge badge-${table.status}`} style={{ fontSize: '9px', marginTop: '8px' }}>
                  {table.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Overdue Alerts */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
            <AlertTriangle size={16} />
            Delayed Kitchen Orders (&gt;40m Limit)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {delayedOrders.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                All active orders are on schedule!
              </div>
            ) : (
              delayedOrders.map(order => {
                const diffMs = new Date() - new Date(order.created_at);
                const diffMins = Math.floor(diffMs / 60000);
                const overdueMins = Math.max(0, diffMins - 40);
                return (
                  <div 
                    key={order.id}
                    className="glass-card"
                    style={{ 
                      padding: '12px', 
                      border: '1px solid rgba(239, 68, 68, 0.4)', 
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      animation: 'pulse 3s infinite'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px' }}>Order #{order.id}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                        Overdue by {overdueMins}m ({diffMins}m total)
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Table: {order.table ? order.table.table_number : 'Takeaway'} | Server: {order.user.name}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </div>

      {/* Staff Attendance logs */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={16} color="var(--color-primary)" />
          Employee Attendance Log (Today)
        </h3>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontWeight: '600', color: '#ffffff' }}>{log.user.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>@{log.user.username}</td>
                  <td>
                    {log.user.role === 'order_taker' && (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-primary)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Order Taker
                      </span>
                    )}
                    {log.user.role === 'chef' && (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--color-secondary)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        Chef / Kitchen
                      </span>
                    )}
                    {log.user.role === 'billing' && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        Billing Desk
                      </span>
                    )}
                    {log.user.role === 'manager' && (
                      <span className="badge badge-served">Manager</span>
                    )}
                    {log.user.role === 'owner' && (
                      <span className="badge badge-served">Restaurant Owner</span>
                    )}
                  </td>
                  <td>{formatTime(log.clock_in)}</td>
                  <td>{formatTime(log.clock_out)}</td>
                  <td>
                    <span className="badge badge-ready">{log.status}</span>
                  </td>
                </tr>

              ))}
              {attendanceLogs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    No staff members have clocked in today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table status overlay modal */}
      {editingTable && (
        <div className="modal-backdrop" onClick={() => setEditingTable(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '12px' }}>Update Table status: {editingTable.table_number}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Select Table State
              </label>
              <select 
                className="form-select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="empty">Empty</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingTable(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleUpdateTableStatus} className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManagerDashboard;
