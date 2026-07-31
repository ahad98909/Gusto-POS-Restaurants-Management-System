import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const listenersRef = useRef(new Set());

  const addListener = (callback) => {
    listenersRef.current.add(callback);
  };

  const removeListener = (callback) => {
    listenersRef.current.delete(callback);
  };

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    const connectWebSocket = () => {
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        wsUrl = `${protocol}//${host}/ws`;
      }
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected.");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket Message Received:", message);
          
          // Append to local notifications list if there's a readable message
          if (message.message) {
            setNotifications(prev => [
              {
                id: Date.now(),
                text: message.message,
                type: message.type,
                timestamp: new Date(),
                read: false
              },
              ...prev.slice(0, 19) // Limit to last 20 notifications
            ]);
          }

          // Trigger all registered listeners
          listenersRef.current.forEach(listener => {
            try {
              listener(message);
            } catch (e) {
              console.error("Error in WS subscriber callback:", e);
            }
          });

        } catch (err) {
          console.error("Error parsing websocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed. Reconnecting in 3s...", event.reason);
        setConnected(false);
        if (token) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <SocketContext.Provider value={{ connected, notifications, addListener, removeListener, clearNotifications, markAllRead }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
