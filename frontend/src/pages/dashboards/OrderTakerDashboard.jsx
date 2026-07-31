import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ClipboardCheck, 
  Send, 
  AlertCircle,
  BellRing
} from 'lucide-react';

const OrderTakerDashboard = () => {
  const { authFetch } = useAuth();
  const { addListener, removeListener } = useSocket();

  // Menu States
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState(['All', 'Starters', 'Mains', 'Desserts', 'Beverages']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart States
  const [cart, setCart] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Active Orders
  const [activeOrders, setActiveOrders] = useState([]);
  const [kitchenAlert, setKitchenAlert] = useState(null);

  // Fetch Menu, Tables and Active Orders
  const fetchData = async () => {
    try {
      // Menu Items
      const menuRes = await authFetch('/api/menu');
      const menuData = await menuRes.json();
      setMenu(menuData);

      // Tables
      const tablesRes = await authFetch('/api/tables');
      const tablesData = await tablesRes.json();
      setTables(tablesData);

      // Active Orders
      const ordersRes = await authFetch('/api/orders');
      const ordersData = await ordersRes.json();
      setActiveOrders(ordersData);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

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
      console.log("Audio notification error:", e);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time events
    const handleWsEvent = (event) => {
      if (event.type === 'ORDER_READY' || (event.type === 'ORDER_STATUS_UPDATE' && event.status === 'ready')) {
        playChimeSound();
        setKitchenAlert({
          id: event.order_id,
          message: event.message || `Order #${event.order_id} is ready to serve!`
        });
        fetchData(); // reload orders list
      } else if (event.type === 'ORDER_STATUS_UPDATE' || event.type === 'NEW_ORDER' || event.type === 'BILL_PAID' || event.type === 'MENU_UPDATE') {
        fetchData();
      }
    };

    addListener(handleWsEvent);
    return () => removeListener(handleWsEvent);
  }, []);


  // Cart Operations
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId, amount) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const nextQty = i.quantity + amount;
        return nextQty > 0 ? { ...i, quantity: nextQty } : i;
      }
      return i;
    }));
  };

  const updateItemNotes = (itemId, notes) => {
    setCart(prev => prev.map(i => i.id === itemId ? { ...i, notes } : i));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Submit Order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert("Your order cart is empty!");
      return;
    }
    if (!selectedTableId) {
      alert("Please select a dining table.");
      return;
    }

    try {
      const orderItems = cart.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        notes: item.notes || null
      }));

      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: parseInt(selectedTableId),
          items: orderItems
        })
      });

      if (res.ok) {
        // Clear cart
        setCart([]);
        setSelectedTableId('');
        setOrderNotes('');
        fetchData();
        alert("Order placed successfully and sent to Chef dashboard!");
      } else {
        const data = await res.json();
        alert(`Failed to place order: ${data.detail || 'unknown error'}`);
      }
    } catch (err) {
      alert("Connection issue placing order.");
    }
  };

  // Serve Order
  const handleMarkServed = async (orderId) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'served' })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Request Bill Generation
  const handleRequestBill = async (orderId) => {
    try {
      const res = await authFetch(`/api/billing/request/${orderId}`, {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          discount: 0.0,
          tax_amount: 0.0
        })
      });
      if (res.ok) {
        fetchData();
        alert("Bill invoice requested! Billing staff will process payment.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Menu
  const filteredMenu = menu.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
      
      {/* Kitchen Alert Notification */}
      {kitchenAlert && (
        <div className="glass-card" style={{
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '2px solid var(--color-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: 'var(--shadow-glow-emerald), 0 10px 30px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              padding: '10px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--color-primary)'
            }}>
              <BellRing size={24} style={{ animation: 'pulse 1s infinite' }} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--color-primary)' }}>
                🔔 KITCHEN NOTIFICATION: Order Ready to Serve!
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
                {kitchenAlert.message}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => {
                handleMarkServed(kitchenAlert.id);
                setKitchenAlert(null);
              }}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              ✓ Mark Order #{kitchenAlert.id} Served
            </button>
            <button 
              onClick={() => setKitchenAlert(null)}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '12px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}


      {/* Main Order Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Side: Menu Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Controls: Categories & Search */}
          <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
            {/* Categories */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '20px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Search */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', borderRadius: '20px' }}
              />
            </div>
          </div>

          {/* Menu Items Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {filteredMenu.map(item => (
              <div 
                key={item.id} 
                className="glass-card glass-card-interactive" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  minHeight: '160px',
                  opacity: item.is_available ? 1 : 0.5
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                      {item.category}
                    </span>
                    <span style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '14px' }}>
                      {item.price} PKR
                    </span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', marginTop: '6px' }}>{item.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description}
                  </p>
                </div>
                
                <button
                  onClick={() => addToCart(item)}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '12px', gap: '4px' }}
                  disabled={!item.is_available}
                >
                  <Plus size={14} /> Add to Cart
                </button>
              </div>
            ))}

            {filteredMenu.length === 0 && (
              <div style={{ gridColumn: 'span 10', padding: '40px', textCenter: 'center', color: 'var(--text-muted)' }}>
                No dishes found matching filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Order Cart Pane */}
        <div className="glass-card" style={{
          position: 'sticky',
          top: '90px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto'
        }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <ShoppingCart size={18} color="var(--color-primary)" />
            Order Cart
          </h2>

          {/* Table Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Assign Dining Table
            </label>
            <select
              className="form-select"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              <option value="">-- Choose Table --</option>
              {tables.map(t => (
                <option key={t.id} value={t.id} disabled={t.status === 'occupied'}>
                  {t.table_number} ({t.capacity} Seats) - {t.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', marginBottom: '16px', maxHeight: '280px', paddingRight: '4px' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px', gap: '8px' }}>
                <AlertCircle size={24} />
                <span>Cart is empty</span>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{item.name}</div>
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {item.price * item.quantity} PKR
                    </div>
                    {/* Qty selectors */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '22px', height: '22px', border: 'none', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={10} />
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '22px', height: '22px', border: 'none', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                  {/* Notes input */}
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Preparation notes..."
                    value={item.notes}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                    style={{ fontSize: '11px', padding: '4px 8px', marginTop: '8px' }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Cart Pricing Summary */}
          {cart.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', marginBottom: '14px' }}>
                <span>Subtotal:</span>
                <span style={{ color: 'var(--color-primary)' }}>{getCartTotal().toLocaleString()} PKR</span>
              </div>
              <button 
                onClick={handlePlaceOrder}
                className="btn btn-primary" 
                style={{ width: '100%', gap: '8px', padding: '12px' }}
              >
                <Send size={14} /> Send Order to Kitchen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Active Placed Orders status */}
      <div className="glass-card">
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <ClipboardCheck size={18} color="var(--color-secondary)" />
          Active Orders Tracker
        </h2>
        
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Table</th>
                <th>Time Placed</th>
                <th>Dish Breakdown</th>
                <th>Order Taker</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 'bold' }}>#{order.id}</td>
                  <td>{order.table ? order.table.table_number : 'Takeaway'}</td>
                  <td>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {order.items.map(item => (
                        <span key={item.id} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          • {item.menu_item.name} x {item.quantity} {item.notes && <i style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.notes})</i>}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-primary)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '11px' }}>
                      {order.user ? order.user.name : 'System'}
                    </span>
                  </td>

                  <td>
                    <span className={`badge badge-${order.status}`}>{order.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {order.status === 'ready' && (
                        <button 
                          onClick={() => handleMarkServed(order.id)}
                          className="btn btn-primary" 
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          Mark Served
                        </button>
                      )}
                      {order.status === 'served' && (
                        <button 
                          onClick={() => handleRequestBill(order.id)}
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                        >
                          Request Bill
                        </button>
                      )}
                      {(order.status === 'pending' || order.status === 'preparing') && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Waiting for Kitchen</span>
                      )}
                      {order.status === 'billed' && (
                        <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600' }}>Settled (Paid)</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {activeOrders.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No active orders found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderTakerDashboard;
