import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { 
  Lock, 
  User as UserIcon, 
  ChefHat, 
  Terminal, 
  Award, 
  BadgeDollarSign, 
  ShieldAlert, 
  Phone, 
  UserPlus, 
  LogIn,
  Users
} from 'lucide-react';

const Login = () => {
  const { login, error: authError, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' or 'register'
  const [activeTab, setActiveTab] = useState('login');

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('order_taker');
  const [regPassword, setRegPassword] = useState('');

  // General Notification States
  const [localError, setLocalError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    if (!username || !password) {
      setLocalError("Please enter both username and password.");
      return;
    }
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      // Error handled by AuthContext or local catch
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    if (!regName || !regUsername || !regPhone || !regPassword) {
      setLocalError("Please fill out all registration fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          username: regUsername,
          phone_number: regPhone,
          role: regRole,
          password: regPassword
        })
      });
      let data = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Internal server error during registration. Please initialize/seed the database.");
      }
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed. Username may already exist.");
      }

      // Success
      setSuccessMessage(`Registration successful for ${regName}! You can now sign in using your credentials.`);
      // Switch back to login
      setActiveTab('login');
      // Autofill registered username
      setUsername(regUsername);
      setPassword('');
      
      // Clear forms
      setRegName('');
      setRegUsername('');
      setRegPhone('');
      setRegRole('order_taker');
      setRegPassword('');

    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleUsername) => {
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await login(roleUsername, 'password123');
      navigate('/');
    } catch (err) {
      setLocalError(`Failed to login with default account. Please make sure database is seeded!`);
    }
  };

  const handleSeedDB = async () => {
    setLocalError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/seed`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("Database seeded successfully! You can now use the Quick Login buttons.");
      } else {
        alert(`Seeding failed: ${data.detail || 'unknown error'}`);
      }
    } catch (err) {
      setLocalError("Could not reach seeding endpoint. Is backend running?");
    }
  };

  return (
    <div className="login-page-wrapper" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '36px' }}>
        
        {/* Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            marginBottom: '12px'
          }}>
            <ChefHat size={28} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Gusto POS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Restaurant Management System
          </p>
        </div>

        {/* Tab Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px',
          marginBottom: '20px'
        }}>
          <button 
            onClick={() => { setActiveTab('login'); setLocalError(null); }}
            style={{
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: activeTab === 'login' ? '#ffffff' : 'var(--text-secondary)',
              background: activeTab === 'login' ? 'var(--color-primary)' : 'transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <LogIn size={14} /> Sign In
          </button>
          <button 
            onClick={() => { setActiveTab('register'); setLocalError(null); }}
            style={{
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: activeTab === 'register' ? '#ffffff' : 'var(--text-secondary)',
              background: activeTab === 'register' ? 'var(--color-primary)' : 'transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={14} /> Register
          </button>
        </div>

        {/* Alerts: Error & Success */}
        {(localError || authError) && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{localError || authError}</span>
          </div>
        )}

        {successMessage && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: 'var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-primary)' }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Sign In panel */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  disabled={authLoading}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  disabled={authLoading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={authLoading}>
              {authLoading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* Register panel */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Hammad Ali"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <UserIcon size={14} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Choose username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase())}
                  style={{ paddingLeft: '34px' }}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Phone size={14} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 0300-1234567"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  style={{ paddingLeft: '34px' }}
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  System Role
                </label>
                <select
                  className="form-select"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  disabled={loading}
                  style={{ fontSize: '13px' }}
                >
                  <option value="order_taker">Order Taker</option>
                  <option value="chef">Chef</option>
                  <option value="billing">Billing Staff</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Registering...' : 'Register Account'}
            </button>
          </form>
        )}

      </div>


      {/* Developer helper panel */}
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', marginTop: '20px', padding: '20px' }}>
        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={14} /> Quick Demo Login (Seed first)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={() => handleQuickLogin('order_taker')} className="btn btn-secondary" style={{ padding: '8px', fontSize: '11px', justifyContent: 'flex-start' }}>
            <Award size={12} color="#10b981" /> Order Taker
          </button>
          <button onClick={() => handleQuickLogin('chef')} className="btn btn-secondary" style={{ padding: '8px', fontSize: '11px', justifyContent: 'flex-start' }}>
            <ChefHat size={12} color="#6366f1" /> Chef
          </button>
          <button onClick={() => handleQuickLogin('billing')} className="btn btn-secondary" style={{ padding: '8px', fontSize: '11px', justifyContent: 'flex-start' }}>
            <BadgeDollarSign size={12} color="#f59e0b" /> Billing
          </button>
          <button onClick={() => handleQuickLogin('manager')} className="btn btn-secondary" style={{ padding: '8px', fontSize: '11px', justifyContent: 'flex-start' }}>
            <Users size={12} color="#06b6d4" /> Manager
          </button>
          <button onClick={() => handleQuickLogin('owner')} className="btn btn-secondary" style={{ padding: '8px', fontSize: '11px', gridColumn: 'span 2', justifyContent: 'center' }}>
            <UserIcon size={12} color="#ef4444" /> Owner (All Permissions)
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
