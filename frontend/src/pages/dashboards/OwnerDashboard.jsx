import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import { 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  Menu, 
  UserCheck, 
  DollarSign, 
  ShoppingBag,
  Award,
  Terminal,
  Receipt,
  Search,
  Printer,
  X,
  CreditCard,
  Banknote,
  QrCode
} from 'lucide-react';

const OwnerDashboard = () => {
  const { authFetch } = useAuth();
  const { addListener, removeListener } = useSocket();

  // Active Tab
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'transactions', 'menu', 'staff'

  // Metrics Data
  const [metrics, setMetrics] = useState({
    revenue_today: 0,
    revenue_month: 0,
    revenue_total: 0,
    total_orders_today: 0,
    total_orders_month: 0,
    active_orders: 0,
    completed_orders: 0,
    popular_items: []
  });

  // Sales transactions list
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Menu items list
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Mains',
    is_available: true
  });

  // Staff and Audit logs
  const [staffPerformance, setStaffPerformance] = useState({ order_takers: [], billing_staff: [] });
  const [auditLogs, setAuditLogs] = useState([]);

  // Printable receipt state
  const [receiptModal, setReceiptModal] = useState({
    show: false,
    tx: null
  });

  const fetchOwnerData = async () => {
    try {
      // 1. Metrics
      const metRes = await authFetch('/api/owner/metrics');
      if (metRes.ok) {
        const metData = await metRes.json();
        setMetrics(metData);
      }

      // 2. Sales Transactions Ledger
      const txRes = await authFetch('/api/owner/sales-history');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }

      // 3. Menu Items
      const menuRes = await authFetch('/api/menu');
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setMenuItems(menuData);
      }

      // 4. Staff Performance
      const staffRes = await authFetch('/api/owner/staff-performance');
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffPerformance(staffData);
      }

      // 5. Audit Logs
      const auditRes = await authFetch('/api/owner/audit-logs');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData);
      }
    } catch (err) {
      console.error("Error fetching owner metrics:", err);
    }
  };

  useEffect(() => {
    fetchOwnerData();

    const handleWsEvent = (event) => {
      if (['BILL_PAID', 'NEW_ORDER', 'MENU_UPDATE', 'ORDER_STATUS_UPDATE'].includes(event.type)) {
        fetchOwnerData();
      }
    };

    addListener(handleWsEvent);
    return () => removeListener(handleWsEvent);
  }, []);

  // Menu Operations
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setItemFormData({
      name: '',
      description: '',
      price: 0,
      category: 'Mains',
      is_available: true
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      is_available: item.is_available
    });
    setShowItemModal(true);
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (!itemFormData.name || itemFormData.price <= 0) {
      alert("Name is required and price must be greater than 0.");
      return;
    }
    
    try {
      let res;
      if (editingItem) {
        res = await authFetch(`/api/menu/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(itemFormData)
        });
      } else {
        res = await authFetch('/api/menu', {
          method: 'POST',
          body: JSON.stringify(itemFormData)
        });
      }

      if (res.ok) {
        setShowItemModal(false);
        fetchOwnerData();
        alert(editingItem ? "Menu item updated!" : "Menu item created!");
      } else {
        const data = await res.json();
        alert(`Failed to save menu item: ${data.detail || 'unknown error'}`);
      }
    } catch (err) {
      alert("Network error saving item.");
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await authFetch(`/api/menu/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchOwnerData();
        alert("Menu item deleted.");
      } else {
        alert("Failed to delete item.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.order_id.toString().includes(q) ||
      tx.order_taker_name.toLowerCase().includes(q) ||
      tx.table_name.toLowerCase().includes(q) ||
      tx.payment_method.toLowerCase().includes(q)
    );
  });

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
      
      {/* Tab Navigation header */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}
          >
            <TrendingUp size={16} /> Sales & Analytics
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}
          >
            <Receipt size={16} /> Business Sales & Ledger
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}
          >
            <Menu size={16} /> Menu Management
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`btn ${activeTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}
          >
            <UserCheck size={16} /> Staff & Audits
          </button>
        </div>
        
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          PKR POS Terminal • Owner Control Panel
        </div>
      </div>

      {/* Tab 1: Sales Analytics */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Executive Revenue & Sales Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* Total Cumulative Business Sales Card */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary-glow)', background: 'rgba(16, 185, 129, 0.04)' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: '800' }}>Total Business Sales</span>
                <h3 style={{ fontSize: '24px', marginTop: '4px', color: 'var(--color-primary)' }}>
                  {(metrics.revenue_total || 0).toLocaleString()} PKR
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All-time settled revenue</span>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-primary)' }}>
                <DollarSign size={26} />
              </div>
            </div>

            {/* Revenue Today */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Revenue Today</span>
                <h3 style={{ fontSize: '24px', marginTop: '4px', color: 'var(--color-warning)' }}>
                  {metrics.revenue_today.toLocaleString()} PKR
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Today's settlements</span>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
                <DollarSign size={26} />
              </div>
            </div>

            {/* Revenue This Month */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Revenue This Month</span>
                <h3 style={{ fontSize: '24px', marginTop: '4px', color: 'var(--color-secondary)' }}>
                  {metrics.revenue_month.toLocaleString()} PKR
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly sales total</span>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-secondary)' }}>
                <DollarSign size={26} />
              </div>
            </div>

            {/* Total Orders Today */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Orders Today</span>
                <h3 style={{ fontSize: '24px', marginTop: '4px' }}>{metrics.total_orders_today}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Active now: {metrics.active_orders}</span>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}>
                <ShoppingBag size={24} />
              </div>
            </div>

          </div>

          {/* Graphical Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            
            {/* Chart: Popular items */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Top Selling Dishes</h3>
              {metrics.popular_items.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No sales recorded yet. Popular items will display once bills are paid.
                </div>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.popular_items} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                        labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="sold" radius={[4, 4, 0, 0]}>
                        {metrics.popular_items.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Popular items breakdown table */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Popularity Rankings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {metrics.popular_items.map((item, idx) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: COLORS[idx % COLORS.length],
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '11px'
                      }}>{idx + 1}</span>
                      <strong style={{ fontSize: '13px' }}>{item.name}</strong>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong>{item.sold}</strong> Units Sold
                    </span>
                  </div>
                ))}

                {metrics.popular_items.length === 0 && (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No sales data found.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: Business Sales & Payment Ledger */}
      {activeTab === 'transactions' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="var(--color-primary)" />
                Complete Business Transactions & Payment Ledger
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                Track every order, assigned Order Taker, payment method, tax, and total amount processed.
              </p>
            </div>

            {/* Search filter */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-input"
                placeholder="Search Order #, Server, or Table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Taker (Server)</th>
                  <th>Table / Type</th>
                  <th>Items Purchased</th>
                  <th>Subtotal</th>
                  <th>GST Tax</th>
                  <th>Discount</th>
                  <th>Net Paid (PKR)</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(tx => (
                  <tr key={tx.bill_id}>
                    <td style={{ fontWeight: 'bold', color: '#ffffff' }}>Order #{tx.order_id}</td>
                    <td style={{ color: 'var(--color-primary-glow)', fontWeight: '500' }}>{tx.order_taker_name}</td>
                    <td><span className="badge badge-served">{tx.table_name}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.items_summary}
                    </td>
                    <td>{tx.subtotal} PKR</td>
                    <td style={{ color: 'var(--text-secondary)' }}>+{tx.tax_amount} PKR</td>
                    <td style={{ color: 'var(--color-danger)' }}>- {tx.discount} PKR</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>{tx.total_amount.toLocaleString()} PKR</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '10px' }}>
                        {tx.payment_method.startsWith('card') ? (
                          <CreditCard size={11} />
                        ) : tx.payment_method === 'qr_code' ? (
                          <QrCode size={11} />
                        ) : (
                          <Banknote size={11} />
                        )}{' '}
                        {tx.payment_method.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tx.payment_status === 'paid' ? 'badge-ready' : 'badge-pending'}`}>
                        {tx.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <button 
                        onClick={() => setReceiptModal({ show: true, tx })}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                      >
                        <Printer size={12} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No payment transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Tab 3: Menu Editor */}
      {activeTab === 'menu' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px' }}>Interactive Menu Manager</h3>
            <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ gap: '6px', padding: '8px 16px', fontSize: '12px' }}>
              <Plus size={16} /> Add Menu Item
            </button>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Dish Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Availability</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                    <td><span className="badge badge-preparing" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-secondary)' }}>{item.category}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.description || '-'}</td>
                    <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{item.price} PKR</td>
                    <td>
                      <span className={`badge ${item.is_available ? 'badge-ready' : 'badge-pending'}`}>
                        {item.is_available ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEditModal(item)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          <Edit size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteMenuItem(item.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.1)' }}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Staff & Audits */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Worker KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={16} color="var(--color-primary)" />
                Order Takers Performance
              </h3>
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th style={{ textAlign: 'right' }}>Total Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.order_takers.map(ot => (
                      <tr key={ot.username}>
                        <td>{ot.name}</td>
                        <td>@{ot.username}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{ot.orders_placed} Orders</td>
                      </tr>
                    ))}
                    {staffPerformance.order_takers.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No statistics recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={16} color="var(--color-warning)" />
                Billing Desk Performance
              </h3>
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th style={{ textAlign: 'right' }}>Bills Settled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.billing_staff.map(bs => (
                      <tr key={bs.username}>
                        <td>{bs.name}</td>
                        <td>@{bs.username}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{bs.bills_processed} Transactions</td>
                      </tr>
                    ))}
                    {staffPerformance.billing_staff.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No settled bills recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="glass-card">
            <h3 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="var(--color-secondary)" />
              Security Audit Logs (Recent Actions)
            </h3>
            
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action Activity</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '600' }}>{log.user ? log.user.name : 'System'}</td>
                      <td style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{log.action}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Menu Item editing Modal */}
      {showItemModal && (
        <div className="modal-backdrop" onClick={() => setShowItemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '16px' }}>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
            
            <form onSubmit={handleSaveMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Dish Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                  placeholder="e.g. Garlic Naan"
                  disabled={!!editingItem}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
                <textarea 
                  className="form-textarea"
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({...itemFormData, description: e.target.value})}
                  placeholder="Ingredients, quantity, spice details"
                  rows="3"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Price (PKR)</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={itemFormData.price}
                    onChange={(e) => setItemFormData({...itemFormData, price: Math.max(0, parseFloat(e.target.value) || 0)})}
                    placeholder="PKR"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Category</label>
                  <select 
                    className="form-select"
                    value={itemFormData.category}
                    onChange={(e) => setItemFormData({...itemFormData, category: e.target.value})}
                  >
                    <option value="Starters">Starters</option>
                    <option value="Mains">Mains</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input 
                  type="checkbox"
                  id="is_available"
                  checked={itemFormData.is_available}
                  onChange={(e) => setItemFormData({...itemFormData, is_available: e.target.checked})}
                />
                <label htmlFor="is_available" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Available in Stock
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowItemModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Printable Receipt Modal */}
      {receiptModal.show && receiptModal.tx && (
        <div className="modal-backdrop" onClick={() => setReceiptModal({ show: false, tx: null })}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '400px', background: '#ffffff', color: '#1e293b', padding: '24px', borderRadius: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}>
                <Printer size={14} /> Print Receipt
              </button>
              <button onClick={() => setReceiptModal({ show: false, tx: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontFamily: 'monospace, sans-serif', fontSize: '12px', color: '#000000' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>GUSTO RESTAURANT</h2>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0' }}>Owner Transaction Copy</p>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px', fontSize: '11px', lineHeight: '1.4' }}>
                <div><strong>Bill ID:</strong> #{receiptModal.tx.bill_id} | <strong>Order ID:</strong> #{receiptModal.tx.order_id}</div>
                <div><strong>Order Taker:</strong> {receiptModal.tx.order_taker_name}</div>
                <div><strong>Table:</strong> {receiptModal.tx.table_name}</div>
                <div><strong>Date/Time:</strong> {new Date(receiptModal.tx.timestamp).toLocaleString()}</div>
                <div><strong>Payment Method:</strong> {receiptModal.tx.payment_method.replace('_', ' ').toUpperCase()}</div>
              </div>

              <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <strong>Purchased Items:</strong>
                <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{receiptModal.tx.items_summary}</p>
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{receiptModal.tx.subtotal.toFixed(2)} PKR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount:</span>
                  <span>- {receiptModal.tx.discount.toFixed(2)} PKR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sales Tax (GST):</span>
                  <span>+ {receiptModal.tx.tax_amount.toFixed(2)} PKR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                  <span>TOTAL PAID:</span>
                  <span>{receiptModal.tx.total_amount.toFixed(2)} PKR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerDashboard;
