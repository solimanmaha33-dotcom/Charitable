import { useEffect, useState } from 'react';

export const OFFLINE_MESSAGE = 'النت فاصل دلوقتي.. ما تقفلش الصفحة واستنى لما يرجع عشان البيانات اللي كتبتها ما تضيعش';

export function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  return offline ? <div className="offline-banner" role="status" aria-live="assertive">{OFFLINE_MESSAGE}</div> : null;
}
