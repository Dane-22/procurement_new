import React, { useEffect, useState } from 'react';
import api from '../../services/api';

async function loadAttachment(filePath) {
  // Only attach credentials to this application's financial-file endpoint.
  const root = api.defaults.baseURL.replace(/\/api\/?$/, '');
  const base = new URL(root, window.location.origin);
  const url = new URL(filePath, base);
  if (url.origin !== base.origin || !/^\/uploads\/(receipts|reimbursements)\/[^/]+$/.test(url.pathname)) {
    throw new Error('Invalid attachment URL');
  }
  const response = await api.get(url.href, { responseType: 'blob', cache: false });
  return URL.createObjectURL(response.data);
}

export function ProtectedImage({ filePath, alt, className }) {
  const [result,setResult] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl;
    loadAttachment(filePath).then(url => {
      objectUrl = url;
      if (active) setResult({filePath,url}); else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setResult({filePath,error:true}); });
    return () => { active = false; if(objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [filePath]);
  const current = result?.filePath === filePath ? result : null;
  if(current?.error) return <p role="alert">Unable to load this attachment.</p>;
  return current?.url ? <img src={current.url} alt={alt} className={className} /> : <p>Loading attachment…</p>;
}

export function ProtectedDownload({ filePath, filename, children, className, title }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const download = async () => {
    let url;
    try {
      setBusy(true);setError(false);
      url = await loadAttachment(filePath);
      const link = document.createElement('a');
      link.href = url;link.download = filename || 'attachment';
      document.body.appendChild(link);link.click();link.remove();
    } catch {setError(true);} finally {
      if(url) setTimeout(() => URL.revokeObjectURL(url),1000);
      setBusy(false);
    }
  };
  return <><button type="button" className={className} title={title} disabled={busy} onClick={download}>{busy?'Downloading…':children}</button>{error&&<span role="alert">Unable to download attachment.</span>}</>;
}
