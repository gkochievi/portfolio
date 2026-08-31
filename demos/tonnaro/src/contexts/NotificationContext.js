import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { playNotificationSound, primeAudio } from '../utils/soundAlerts';

const DEFAULT_POLL_INTERVAL_MS = 10000;
const POLL_INTERVAL_MS = (() => {
  const raw = parseInt(process.env.REACT_APP_NOTIFICATION_POLL_MS, 10);
  if (!raw || raw <= 0) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(1000, raw);
})();
const NotificationContext = createContext(null);

const MUTE_KEY = 'notifications:muted';

function readMutePref() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMutePref(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function NotificationProvider({ children }) {
  const { user, isAdmin } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  // Per-saved-view counters, keyed by view name
  // ('all'/'unread'/'awaiting_price'/'pending_customer'/'today'/'in_progress'/'history').
  // Backed by the same admin notifications endpoint so the tabs on
  // AdminOrdersPage stay in lockstep with the bell badge.
  const [viewCounts, setViewCounts] = useState({});
  const [recent, setRecent] = useState([]);
  const [latestEventAt, setLatestEventAt] = useState(null);
  const [tick, setTick] = useState(0);
  const [muted, setMuted] = useState(readMutePref);

  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastSeenEventRef = useRef(null);
  const mutedRef = useRef(muted);
  const firstFetchRef = useRef(true);
  const userIdRef = useRef(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const endpoint = isAdmin ? '/orders/admin/notifications/' : '/orders/notifications/';
  const markReadEndpoint = isAdmin
    ? '/orders/admin/notifications/mark-read/'
    : '/orders/notifications/mark-read/';

  const reset = useCallback(() => {
    setUnreadCount(0);
    setNewOrdersCount(0);
    setActiveOrdersCount(0);
    setViewCounts({});
    setRecent([]);
    setLatestEventAt(null);
    lastSeenEventRef.current = null;
    firstFetchRef.current = true;
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { data } = await api.get(endpoint);
      setUnreadCount(data.unread_count || 0);
      setNewOrdersCount(data.new_orders_count || 0);
      setActiveOrdersCount(data.active_orders_count || 0);
      setViewCounts(data.view_counts || {});
      setRecent(Array.isArray(data.recent_unread) ? data.recent_unread : []);
      setLatestEventAt(data.latest_event_at || null);

      const prevSeen = lastSeenEventRef.current;
      const latest = data.latest_event_at || null;

      const becameNew = !firstFetchRef.current
        && latest
        && prevSeen
        && latest !== prevSeen
        && new Date(latest) > new Date(prevSeen);

      if (becameNew) {
        if (!mutedRef.current) {
          const firstRecent = (data.recent_unread || [])[0];
          const evt = firstRecent?.last_event_type || '';
          // Sound rule: each side only hears the OTHER side's actions, so
          // admins don't hear their own assigns/status changes.
          // Admin-audible = customer-initiated events ('created', 'cancelled',
          //   'status:approved' (customer accepted offer), 'images_added').
          // Customer-audible = admin-initiated events (any 'status:*' the admin
          //   set, plus 'edited'/'updated').
          const CUSTOMER_ORIGIN_EVENTS = new Set([
            'created', 'cancelled', 'images_added', 'status:approved',
          ]);
          const ADMIN_ORIGIN_PREFIXES = ['status:'];
          const ADMIN_ORIGIN_EVENTS = new Set(['edited', 'updated']);
          const audible = isAdmin
            ? CUSTOMER_ORIGIN_EVENTS.has(evt)
            : (ADMIN_ORIGIN_EVENTS.has(evt)
                || ADMIN_ORIGIN_PREFIXES.some((p) => evt.startsWith(p)));
          if (audible) {
            const kind = isAdmin ? 'newOrder' : 'status';
            playNotificationSound(
              evt.startsWith('status:') ? 'status' : kind,
            );
          }
        }
        // notify listeners that new activity occurred — pages can refetch their data
        setTick((t) => t + 1);
      }
      lastSeenEventRef.current = latest;
      firstFetchRef.current = false;
    } catch {
      /* swallow — poll will retry */
    } finally {
      inFlightRef.current = false;
    }
  }, [endpoint, isAdmin, user]);

  // reset state when user logs out or switches account
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (userIdRef.current !== currentId) {
      userIdRef.current = currentId;
      reset();
    }
  }, [user, reset]);

  // start / stop polling
  useEffect(() => {
    if (!user) return undefined;
    refresh();
    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  const markAllRead = useCallback(async (ids) => {
    try {
      await api.post(markReadEndpoint, ids ? { ids } : {});
      // optimistic update
      setUnreadCount(0);
      setRecent([]);
      await refresh();
    } catch {
      /* ignore */
    }
  }, [markReadEndpoint, refresh]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      writeMutePref(next);
      if (!next) {
        // user un-muted → prime audio so next beep works without extra click
        primeAudio();
      }
      return next;
    });
  }, []);

  const value = {
    unreadCount,
    newOrdersCount,
    activeOrdersCount,
    viewCounts,
    recent,
    latestEventAt,
    tick,
    muted,
    toggleMute,
    refresh,
    markAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // No-op fallback so pages can safely call this even on public routes.
    return {
      unreadCount: 0,
      newOrdersCount: 0,
      activeOrdersCount: 0,
      viewCounts: {},
      recent: [],
      latestEventAt: null,
      tick: 0,
      muted: false,
      toggleMute: () => {},
      refresh: () => {},
      markAllRead: () => {},
    };
  }
  return ctx;
}

/**
 * Refetch a page's data whenever the global notification poller detects new activity.
 * Pass a stable callback (e.g. wrapped in useCallback) plus deps for fetchFn identity.
 */
export function useRealtimeRefresh(fetchFn, deps = []) {
  const { tick } = useNotifications();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (typeof fetchFn === 'function') fetchFn();
  }, [tick, fetchFn, ...deps]);
}
