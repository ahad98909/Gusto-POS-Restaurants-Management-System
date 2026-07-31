import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('gusto_token'));
  const [user, setUser] = useState(() => {
    const role = localStorage.getItem('gusto_role');
    const name = localStorage.getItem('gusto_name');
    const username = localStorage.getItem('gusto_username');
    return role ? { role, name, username } : null;
  });
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkAttendanceStatus = async (authToken = token) => {
    if (!authToken) {
      setAttendance(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/manager/attendance/today`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAttendance({
            clockedIn: true,
            clockedOut: !!data.clock_out,
            time: data.clock_in
          });
        } else {
          setAttendance(null);
        }
      } else {
        setAttendance(null);
      }
    } catch (err) {
      console.error("Error checking attendance status:", err);
      setAttendance(null);
    }
  };

  useEffect(() => {
    if (token) {
      checkAttendanceStatus(token);
    } else {
      setAttendance(null);
    }
  }, [token]);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      let data = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // Non-JSON response (e.g. 500 Internal Server Error text)
        throw new Error("Internal server error. Please make sure the database is seeded.");
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Username or password was incorrect");
        }
        throw new Error(data.detail || 'Login failed. Please check your credentials.');
      }

      setToken(data.access_token);
      const loggedUser = {
        role: data.role,
        name: data.name,
        username: username
      };
      setUser(loggedUser);

      localStorage.setItem('gusto_token', data.access_token);
      localStorage.setItem('gusto_role', data.role);
      localStorage.setItem('gusto_name', data.name);
      localStorage.setItem('gusto_username', username);
      
      // Auto clock-in status check and clock-in on login
      try {
        const checkRes = await fetch(`${API_BASE_URL}/api/manager/attendance/today`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData) {
            setAttendance({
              clockedIn: true,
              clockedOut: !!checkData.clock_out,
              time: checkData.clock_in
            });
          } else {
            // Not clocked in yet, clock them in now
            await clockIn(data.access_token);
          }
        } else {
          await clockIn(data.access_token);
        }
      } catch (attErr) {
        console.log("Clock-in status check/action failed:", attErr.message);
      }
      
      return loggedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Attempt backend logout to record audit log
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error("Backend logout log error:", err);
      }

      // Attempt auto clock-out before logging out
      try {
        await clockOut(token);
      } catch (err) {
        console.log("Clock-out during logout skipped:", err.message);
      }
    }
    
    setToken(null);
    setUser(null);
    setAttendance(null);
    localStorage.removeItem('gusto_token');
    localStorage.removeItem('gusto_role');
    localStorage.removeItem('gusto_name');
    localStorage.removeItem('gusto_username');
  };

  const clockIn = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/manager/attendance/clock-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAttendance({ clockedIn: true, time: data.clock_in });
      } else if (res.status === 400 && data.detail && data.detail.includes("already clocked in")) {
        // If already clocked in, fetch today's status to sync correctly
        await checkAttendanceStatus(authToken);
      }
    } catch (err) {
      console.error("Error clocking in:", err);
    }
  };

  const clockOut = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/manager/attendance/clock-out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAttendance(prev => ({ ...prev, clockedOut: true }));
      } else if (res.status === 400 && data.detail && data.detail.includes("already clocked out")) {
        setAttendance(prev => ({ ...prev, clockedOut: true }));
      } else if (res.status === 400 && data.detail && data.detail.includes("haven't clocked in")) {
        setAttendance(null);
      }
    } catch (err) {
      console.error("Error clocking out:", err);
    }
  };

  // Helper fetch wrapper to include bearer token
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ token, user, error, loading, attendance, login, logout, clockIn, clockOut, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
