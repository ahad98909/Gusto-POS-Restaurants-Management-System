import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Printer, 
  CreditCard, 
  Banknote, 
  FileText, 
  CheckCircle, 
  Percent, 
  Receipt, 
  Search, 
  User, 
  Utensils, 
  X, 
  Eye,
  Download,
  QrCode
} from 'lucide-react';

const BillingDashboard = () => {
  const { authFetch } = useAuth();
  const { addListener, removeListener } = useSocket();

  // Data states
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeBill, setActiveBill] = useState(null);

  // Tab & Search states
  const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid', 'paid', 'all'
  const [searchQuery, setSearchQuery] = useState('');

  // Billing adjustments for selected order
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(16); // Default 16% GST
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Card Payment Info State
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessingCard, setIsProcessingCard] = useState(false);

  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16) val = val.substring(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  const handleCardExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 4) val = val.substring(0, 4);
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2);
    }
    setCardExpiry(val);
  };


  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState({
    show: false,
    order: null,
    bill: null
  });

  const fetchOrdersAndBills = async () => {
    try {
      // 1. Fetch all orders
      const ordersRes = await authFetch('/api/orders');
      const ordersData = await ordersRes.json();
      setOrders(ordersData);

      // 2. Fetch all bills
      const billsRes = await authFetch('/api/billing/all');
      const billsData = await billsRes.json();
      setBills(billsData);

      // Keep selected order updated
      if (selectedOrder) {
        const updatedSelected = ordersData.find(o => o.id === selectedOrder.id);
        if (updatedSelected) {
          setSelectedOrder(updatedSelected);
          const b = billsData.find(b => b.order_id === updatedSelected.id);
          if (b) setActiveBill(b);
        }
      }
    } catch (err) {
      console.error("Error fetching billing data:", err);
    }
  };

  const fetchOrdersAndBillsRef = useRef(fetchOrdersAndBills);
  useEffect(() => {
    fetchOrdersAndBillsRef.current = fetchOrdersAndBills;
  });

  useEffect(() => {
    fetchOrdersAndBills();

    const handleWsEvent = (event) => {
      if (['BILL_REQUESTED', 'ORDER_SERVED', 'BILL_PAID', 'ORDER_STATUS_UPDATE', 'NEW_ORDER'].includes(event.type)) {
        fetchOrdersAndBillsRef.current();
      }
    };

    addListener(handleWsEvent);
    return () => removeListener(handleWsEvent);
  }, []);

  const round = (num, decimals = 2) => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    setDiscountPercent(0);
    setTaxPercent(16);

    try {
      const res = await authFetch(`/api/billing/order/${order.id}`);
      const billData = await res.json();
      if (res.ok) {
        setActiveBill(billData);
        if (billData.discount > 0 && order.total_amount > 0) {
          setDiscountPercent(round((billData.discount / order.total_amount) * 100));
        }
        if (billData.tax_amount > 0 && order.total_amount > 0) {
          setTaxPercent(round((billData.tax_amount / order.total_amount) * 100));
        }
      }
    } catch (err) {
      console.error("Error fetching/creating bill for order:", err);
    }
  };

  // Live calculations
  const getSubtotal = () => selectedOrder ? selectedOrder.total_amount : 0;
  const getTaxAmount = () => round(getSubtotal() * (taxPercent / 100));
  const getDiscountAmount = () => round(getSubtotal() * (discountPercent / 100));
  const getNetTotal = () => round(getSubtotal() + getTaxAmount() - getDiscountAmount());

  // Apply changes to bill record
  const handleRecalculateBill = async () => {
    if (!selectedOrder) return;
    try {
      const res = await authFetch(`/api/billing/request/${selectedOrder.id}`, {
        method: 'POST',
        body: JSON.stringify({
          order_id: selectedOrder.id,
          discount: getDiscountAmount(),
          tax_amount: getTaxAmount()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveBill(data);
        fetchOrdersAndBills();
        alert("Invoice calculations updated!");
      }
    } catch (err) {
      alert("Error updating calculations.");
    }
  };

  const handlePayBill = async () => {
    if (!activeBill) return;

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (!cardName.trim()) {
        alert("Please enter Cardholder Name.");
        return;
      }
      if (cleanNum.length < 15) {
        alert("Please enter a valid 16-digit Card Number.");
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        alert("Please enter a valid Expiry Date (MM/YY).");
        return;
      }
      if (cardCvc.length < 3) {
        alert("Please enter a 3 or 4 digit CVC code.");
        return;
      }

      setIsProcessingCard(true);
      await new Promise(r => setTimeout(r, 1200));
    }

    try {
      const res = await authFetch(`/api/billing/${activeBill.id}/pay`, {
        method: 'PUT',
        body: JSON.stringify({
          payment_status: 'paid',
          payment_method: paymentMethod,
          card_number: cardNumber,
          card_expiry: cardExpiry,
          card_cvc: cardCvc,
          card_holder: cardName
        })
      });
      setIsProcessingCard(false);

      if (res.ok) {
        alert(`Payment of ${getNetTotal().toLocaleString()} PKR confirmed via ${paymentMethod.toUpperCase()}! Table released.`);
        setSelectedOrder(null);
        setActiveBill(null);
        setCardName('');
        setCardNumber('');
        setCardExpiry('');
        setCardCvc('');
        fetchOrdersAndBills();
      } else {
        const data = await res.json();
        alert(`Failed to confirm payment: ${data.detail || 'unknown error'}`);
      }
    } catch (err) {
      setIsProcessingCard(false);
      alert("Failed to confirm payment.");
    }
  };


  // Open receipt print modal for any order
  const handleOpenReceiptModal = async (order, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await authFetch(`/api/billing/order/${order.id}`);
      const billData = await res.json();
      setReceiptModal({
        show: true,
        order: order,
        bill: billData
      });
    } catch (err) {
      console.error(err);
      alert("Could not load receipt for printing.");
    }
  };

  // Authenticated PDF Download
  const handleDownloadPDF = async (billId, orderId) => {
    try {
      const res = await authFetch(`/api/billing/${billId}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_Order_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error downloading PDF invoice: " + err.message);
    }
  };

  // Trigger browser print
  const handleTriggerPrint = () => {
    window.print();
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const bill = bills.find(b => b.order_id === order.id);
    const isPaid = bill && bill.payment_status === 'paid';
    
    // Tab Filter
    if (activeTab === 'unpaid' && isPaid) return false;
    if (activeTab === 'paid' && !isPaid) return false;

    // Search Filter (Order ID, Order Taker Name, Table Number)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const orderIdStr = order.id.toString();
      const takerName = (order.user?.name || '').toLowerCase();
      const tableName = (order.table?.table_number || 'takeaway').toLowerCase();
      return orderIdStr.includes(query) || takerName.includes(query) || tableName.includes(query);
    }

    return true;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px', padding: '10px 0' }}>
      
      {/* Left Pane: Orders & Bills Queue */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        
        {/* Header & Tabs */}
        <div>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Receipt size={20} color="var(--color-warning)" />
            Billing & Invoices Queue
          </h2>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setActiveTab('unpaid')}
              className={`btn ${activeTab === 'unpaid' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
            >
              Unpaid ({orders.filter(o => {
                const b = bills.find(x => x.order_id === o.id);
                return !b || b.payment_status === 'unpaid';
              }).length})
            </button>
            <button 
              onClick={() => setActiveTab('paid')}
              className={`btn ${activeTab === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
            >
              Settled ({bills.filter(b => b.payment_status === 'paid').length})
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
            >
              All ({orders.length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
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

        {/* Orders Queue List */}
        {filteredOrders.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px', gap: '8px' }}>
            <CheckCircle size={32} color="var(--color-primary)" />
            <span>No orders match this criteria.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              const bill = bills.find(b => b.order_id === order.id);
              const isPaid = bill && bill.payment_status === 'paid';
              const orderTakerName = order.user ? order.user.name : 'System';

              return (
                <div 
                  key={order.id} 
                  onClick={() => handleSelectOrder(order)}
                  className="glass-card glass-card-interactive"
                  style={{ 
                    cursor: 'pointer',
                    padding: '14px',
                    borderColor: isSelected ? 'var(--color-warning)' : (isPaid ? 'var(--color-primary)' : 'var(--border-color)'),
                    background: isSelected ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-card)'
                  }}
                >
                  {/* Card Header: Order ID & Table Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '15px', color: '#ffffff' }}>Order #{order.id}</strong>
                      <span className={`badge ${isPaid ? 'badge-ready' : 'badge-pending'}`} style={{ fontSize: '9px' }}>
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>
                    <span className="badge badge-served" style={{ fontSize: '10px' }}>
                      {order.table ? order.table.table_number : 'Takeaway'}
                    </span>
                  </div>
                  
                  {/* Order Taker Name & Time */}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary-glow)' }}>
                      <User size={13} />
                      <span>Order Taker: <strong>{orderTakerName}</strong></span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span>Items: <strong>{order.items ? order.items.reduce((acc, i) => acc + i.quantity, 0) : 0} items</strong></span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-warning)' }}>
                        {bill ? bill.total_amount : order.total_amount} PKR
                      </strong>
                    </div>
                  </div>

                  {/* Actions Bar: Separate Print Button on Every Order */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <button 
                      onClick={(e) => handleOpenReceiptModal(order, e)}
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '6px 10px', fontSize: '11px', gap: '4px', justifyContent: 'center' }}
                      title="Print receipt for this order"
                    >
                      <Printer size={13} /> Print Bill
                    </button>
                    <button 
                      onClick={() => handleSelectOrder(order)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '11px', gap: '4px', justifyContent: 'center' }}
                    >
                      <Eye size={13} /> View Ledger
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Pane: Invoice ledger */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        {selectedOrder ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Invoice Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Invoice Ledger: Order #{selectedOrder.id}
                  {activeBill?.payment_status === 'paid' && (
                    <span className="badge badge-ready" style={{ fontSize: '11px' }}>PAID</span>
                  )}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                  Dining Table: <strong>{selectedOrder.table ? selectedOrder.table.table_number : 'Takeaway'}</strong> | Order Taker: <strong>{selectedOrder.user ? selectedOrder.user.name : 'System'}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => handleOpenReceiptModal(selectedOrder, e)} 
                  className="btn btn-secondary" 
                  style={{ gap: '6px', fontSize: '12px' }}
                >
                  <Printer size={15} /> Print Receipt
                </button>
                {activeBill && (
                  <button 
                    onClick={() => handleDownloadPDF(activeBill.id, selectedOrder.id)} 
                    className="btn btn-secondary" 
                    style={{ gap: '6px', fontSize: '12px' }}
                  >
                    <Download size={15} /> PDF
                  </button>
                )}
              </div>
            </div>

            {/* Bill breakdown table */}
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Unit Price</th>
                    <th>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '500' }}>{item.menu_item.name}</td>
                      <td>{item.unit_price} PKR</td>
                      <td>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{(item.unit_price * item.quantity).toLocaleString()} PKR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Adjustments: Discount & Tax inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left adjustments panel */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Bill Modifiers
                </h4>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Discount Percentage (%)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Percent size={14} color="var(--text-muted)" />
                    <input
                      type="number"
                      className="form-input"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      min="0"
                      max="100"
                      disabled={activeBill?.payment_status === 'paid'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Sales Tax / GST Rate (%)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    min="0"
                    disabled={activeBill?.payment_status === 'paid'}
                  />
                </div>

                {activeBill?.payment_status !== 'paid' && (
                  <button 
                    onClick={handleRecalculateBill} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', fontSize: '12px', padding: '8px', color: 'var(--color-primary)', borderColor: 'var(--color-primary-glow)' }}
                  >
                    Apply & Recalculate
                  </button>
                )}
              </div>

              {/* Right summary pane */}
              <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Subtotal:</span>
                    <span>{getSubtotal().toLocaleString()} PKR</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-danger)' }}>
                    <span>Discount:</span>
                    <span>- {getDiscountAmount().toLocaleString()} PKR</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Sales Tax (GST):</span>
                    <span>+ {getTaxAmount().toLocaleString()} PKR</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '10px', color: '#ffffff' }}>
                    <span>Net Amount Due:</span>
                    <span style={{ color: 'var(--color-warning)' }}>{getNetTotal().toLocaleString()} PKR</span>
                  </div>
                </div>
                
                {/* Payment Selection */}
                {activeBill?.payment_status === 'paid' ? (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                    <CheckCircle size={24} color="var(--color-primary)" style={{ margin: '0 auto 4px auto' }} />
                    <strong style={{ color: 'var(--color-primary)', fontSize: '14px' }}>Bill Settled ({activeBill.payment_method.replace('_', ' ').toUpperCase()})</strong>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Settled at {new Date(activeBill.generated_at).toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Payment Method
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '8px', fontSize: '12px', gap: '6px' }}
                      >
                        <Banknote size={14} /> Cash
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('card')}
                        className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '8px', fontSize: '12px', gap: '6px' }}
                      >
                        <CreditCard size={14} /> Card
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('qr_code')}
                        className={`btn ${paymentMethod === 'qr_code' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '8px', fontSize: '12px', gap: '6px' }}
                      >
                        <QrCode size={14} /> QR Code
                      </button>
                    </div>

                    {/* Card Terminal Input Form */}
                    {paymentMethod === 'card' && (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        marginBottom: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-secondary)', textTransform: 'uppercase' }}>
                            💳 Card Payment Terminal
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                            {cardNumber.startsWith('4') ? 'VISA' : cardNumber.startsWith('5') ? 'MASTERCARD' : 'PAYPAK / CARD'}
                          </span>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Cardholder Name *
                          </label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Ahad Ali" 
                            value={cardName} 
                            onChange={(e) => setCardName(e.target.value)}
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Card Number *
                          </label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="4111 2222 3333 4444" 
                            maxLength={19}
                            value={cardNumber} 
                            onChange={handleCardNumberChange}
                            style={{ fontSize: '12px', padding: '6px 10px', fontFamily: 'monospace', letterSpacing: '1px' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              Expiry (MM/YY) *
                            </label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="12/28" 
                              maxLength={5}
                              value={cardExpiry} 
                              onChange={handleCardExpiryChange}
                              style={{ fontSize: '12px', padding: '6px 10px', fontFamily: 'monospace' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              CVC / CVV *
                            </label>
                            <input 
                              type="password" 
                              className="form-input" 
                              placeholder="•••" 
                              maxLength={4}
                              value={cardCvc} 
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                              style={{ fontSize: '12px', padding: '6px 10px', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* QR Code Scanner Terminal */}
                    {paymentMethod === 'qr_code' && (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '16px',
                        marginBottom: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        textAlign: 'center'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                          📱 Scan QR Code to Pay
                        </span>
                        
                        <div style={{
                          padding: '10px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          display: 'inline-block',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=0f172a&data=${encodeURIComponent(`GustoPOS:Bill:${activeBill.id}:Amount:${getNetTotal()}:PKR`)}`}
                            alt="Payment QR Code"
                            style={{ display: 'block', width: '160px', height: '160px' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div style={{
                            display: 'none',
                            width: '160px',
                            height: '160px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#1e293b',
                            color: '#ffffff',
                            flexDirection: 'column',
                            gap: '8px',
                            borderRadius: '4px'
                          }}>
                            <QrCode size={48} color="var(--color-primary)" />
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>QR Offline Mode</span>
                          </div>
                        </div>
                        
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Scan using **EasyPaisa**, **JazzCash**, or any **banking app** to settle the amount of <strong style={{ color: 'var(--color-warning)' }}>{getNetTotal().toLocaleString()} PKR</strong>.
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={handlePayBill} 
                      disabled={isProcessingCard}
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: isProcessingCard ? 'var(--color-secondary)' : 'var(--color-primary)',
                        cursor: isProcessingCard ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isProcessingCard ? '💳 Authorizing Card Terminal...' : 'Complete Payment & Close Out'}
                    </button>
                  </div>

                )}
              </div>

            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '12px', minHeight: '300px' }}>
            <FileText size={40} />
            <h3 style={{ fontWeight: '500' }}>Select an order from the queue to view or generate invoice.</h3>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      {receiptModal.show && receiptModal.order && (
        <div className="modal-backdrop" onClick={() => setReceiptModal({ show: false, order: null, bill: null })}>
          <div 
            className="modal-content printable-receipt" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '400px', background: '#ffffff', color: '#1e293b', padding: '24px', borderRadius: '12px' }}
          >
            {/* Modal Actions Header */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleTriggerPrint} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}>
                  <Printer size={14} /> Print Now
                </button>
                {receiptModal.bill && (
                  <button onClick={() => handleDownloadPDF(receiptModal.bill.id, receiptModal.order.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', color: '#1e293b' }}>
                    <Download size={14} /> Download PDF
                  </button>
                )}
              </div>
              <button onClick={() => setReceiptModal({ show: false, order: null, bill: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Thermal Receipt Content */}
            <div id="receipt-print-area" style={{ fontFamily: 'monospace, sans-serif', fontSize: '12px', color: '#000000' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>GUSTO RESTAURANT</h2>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0' }}>Full-Service POS Receipt</p>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px', fontSize: '11px', lineHeight: '1.4' }}>
                <div><strong>Order ID:</strong> #{receiptModal.order.id}</div>
                <div><strong>Order Taker:</strong> {receiptModal.order.user ? receiptModal.order.user.name : 'System'}</div>
                <div><strong>Table:</strong> {receiptModal.order.table ? receiptModal.order.table.table_number : 'Takeaway'}</div>
                <div><strong>Date/Time:</strong> {new Date(receiptModal.order.created_at).toLocaleString()}</div>
                <div><strong>Payment Method:</strong> {receiptModal.bill?.payment_method?.replace('_', ' ')?.toUpperCase() || 'CASH'}</div>
              </div>

              {/* Items List */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '4px' }}>Item</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptModal.order.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding: '3px 0' }}>{item.menu_item.name}</td>
                      <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right' }}>{(item.unit_price * item.quantity).toFixed(2)} PKR</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Breakdown */}
              <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{receiptModal.bill ? receiptModal.bill.subtotal.toFixed(2) : receiptModal.order.total_amount.toFixed(2)} PKR</span>
                </div>
                {receiptModal.bill && receiptModal.bill.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>- {receiptModal.bill.discount.toFixed(2)} PKR</span>
                  </div>
                )}
                {receiptModal.bill && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sales Tax (GST):</span>
                    <span>+ {receiptModal.bill.tax_amount.toFixed(2)} PKR</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                  <span>NET TOTAL:</span>
                  <span>{receiptModal.bill ? receiptModal.bill.total_amount.toFixed(2) : receiptModal.order.total_amount.toFixed(2)} PKR</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px dashed #000', fontSize: '10px' }}>
                Thank you for dining with us!
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BillingDashboard;
