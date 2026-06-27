import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Plus, MessageSquare, Upload, Send, FileText, LogOut, BookOpen, X, Loader2 } from 'lucide-react';

interface Message { id?: string; role: 'USER' | 'AI' | 'user' | 'ai'; content: string; }
interface Workspace { id: string; name: string; }
interface Doc { id: string; filename: string; size: number; uploadStatus: string; }
interface Chat { id: string; title: string; }

const API = 'http://localhost:3000';

const req = (method: string, body?: object) => {
  const init: RequestInit = {
    method,
    credentials: 'include',
  };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return init;
};

const CHIPS = ['Summarize key findings', 'List main arguments', 'What conclusions are drawn?', 'Identify any contradictions'];

function fmtBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1048576).toFixed(1)}MB`;
}

const DocSVG = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const LogoMark = () => (
  <div className="logo-mark">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  </div>
);

export default function ChatApp({ onLogout }: { onLogout: () => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDocs, setShowDocs] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Handle API auth errors universally
  const handleFetchError = (res: Response) => {
    if (res.status === 401) onLogout();
  };

  useEffect(() => {
    fetch(`${API}/workspaces`, { credentials: 'include' })
      .then(r => { handleFetchError(r); return r.ok ? r.json() : []; })
      .then((d: Workspace[]) => Array.isArray(d) && setWorkspaces(d))
      .catch(() => {});
  }, [onLogout]);

  // Document fetching & polling
  useEffect(() => {
    if (!activeWs) return;
    const fetchDocs = () => {
      fetch(`${API}/documents?workspaceId=${activeWs.id}`, { credentials: 'include' })
        .then(r => { handleFetchError(r); return r.ok ? r.json() : null; })
        .then((d: Doc[]) => {
          if (Array.isArray(d)) setDocs(d);
        })
        .catch(() => {});
    };

    fetchDocs();
    const interval = setInterval(() => {
      // Only poll if there's a document still processing
      setDocs(currentDocs => {
        if (currentDocs.some(d => d.uploadStatus !== 'COMPLETED')) {
          fetchDocs();
        }
        return currentDocs;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [activeWs, onLogout]);

  // Load latest chat on workspace change
  useEffect(() => {
    if (!activeWs) return;
    fetch(`${API}/chat/workspace/${activeWs.id}`, { credentials: 'include' })
      .then(r => { handleFetchError(r); return r.ok ? r.json() : []; })
      .then((chats: Chat[]) => {
        if (chats && chats.length > 0) {
          const latestChat = chats[0];
          setActiveChatId(latestChat.id);
          // Fetch its history
          fetch(`${API}/chat/history/${latestChat.id}`, { credentials: 'include' })
            .then(r => r.json())
            .then((history: Message[]) => setMessages(history))
            .catch(() => {});
        } else {
          setActiveChatId(null);
          setMessages([]);
        }
      })
      .catch(() => {});
  }, [activeWs, onLogout]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const resize = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setMessages(p => [...p, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/chat/message`, {
        ...req('POST', { message: text, workspaceId: activeWs?.id, chatId: activeChatId }),
      });
      handleFetchError(r);
      const d = await r.json() as { response?: string; message?: string; chatId?: string };
      if (d.chatId && !activeChatId) setActiveChatId(d.chatId);
      setMessages(p => [...p, { role: 'ai', content: d.response ?? d.message ?? 'No response.' }]);
    } catch {
      setMessages(p => [...p, { role: 'ai', content: 'Failed to get a response. Please try again.' }]);
    } finally { setLoading(false); }
  };

  const createWs = async () => {
    const name = prompt('Workspace name:');
    if (!name?.trim()) return;
    const r = await fetch(`${API}/workspaces`, req('POST', { name: name.trim() }));
    handleFetchError(r);
    if (!r.ok) return;
    const ws = await r.json() as Workspace;
    setWorkspaces(p => [ws, ...p]);
    setActiveWs(ws);
    setActiveChatId(null);
    setMessages([]);
    setDocs([]);
  };

  const handleLogout = async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    onLogout();
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (activeWs) fd.append('workspaceId', activeWs.id);
    try {
      const r = await fetch(`${API}/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      handleFetchError(r);
      if (r.ok) {
        const doc = await r.json() as Doc;
        setDocs(p => [doc, ...p]);
        setMessages(p => [...p, {
          role: 'ai',
          content: `"${file.name}" uploaded. Processing in the background — ask questions about it shortly.`,
        }]);
      } else {
        alert('Upload failed.');
      }
    } catch { alert('Upload failed.'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <LogoMark />
          <span className="logo-name">ResearchFlow</span>
        </div>

        <div className="sidebar-body">
          <button className="new-ws-btn" onClick={createWs}>
            <Plus size={13} />
            New Workspace
          </button>

          {workspaces.length > 0 && (
            <>
              <p className="sidebar-label" style={{ marginTop: 10 }}>Workspaces</p>
              {workspaces.map(ws => (
                <button key={ws.id} className={`sidebar-item ${activeWs?.id === ws.id ? 'active' : ''}`}
                  onClick={() => { setActiveWs(ws); }}>
                  <MessageSquare size={13} />
                  <span className="ws-name">{ws.name}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-item" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <span className="topbar-title">{activeWs?.name ?? 'ResearchFlow'}</span>
          <div className="topbar-actions">
            {activeWs && (
              <>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={uploadFile} />
                <button className="tb-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                  {uploading ? 'Uploading…' : 'Upload PDF'}
                </button>
                <button className="tb-icon" title="Documents" onClick={() => setShowDocs(s => !s)}>
                  <FileText size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="chat-scroll">
          {!activeWs ? (
            <div className="chat-inner">
              <div className="welcome">
                <div className="welcome-icon"><BookOpen size={22} color="var(--text-3)" /></div>
                <h2>Select a workspace</h2>
                <p>Create a workspace from the sidebar, then upload documents to start your research.</p>
              </div>
            </div>
          ) : !hasMessages ? (
            <div className="chat-inner">
              <div className="welcome">
                <div className="welcome-icon"><MessageSquare size={22} color="var(--text-3)" /></div>
                <h2>Ask about your documents</h2>
                <p>Upload a PDF then ask any question. The AI answers using only your documents.</p>
                <div className="chips">
                  {CHIPS.map(c => (
                    <button key={c} className="chip" onClick={() => { setInput(c); taRef.current?.focus(); }}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="chat-inner">
              {messages.map((m, i) => (
                <div key={i} className={`msg-row ${m.role.toLowerCase()}`}>
                  <div className={`avatar ${m.role.toLowerCase()}`}>{m.role.toLowerCase() === 'ai' ? '✦' : 'U'}</div>
                  <div className={`bubble ${m.role.toLowerCase() === 'ai' ? 'bubble-md' : ''}`}>
                    {m.role.toLowerCase() === 'ai'
                      ? <ReactMarkdown>{m.content}</ReactMarkdown>
                      : m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="msg-row ai">
                  <div className="avatar ai">✦</div>
                  <div className="bubble">
                    <div className="typing"><div className="dot" /><div className="dot" /><div className="dot" /></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {activeWs && (
          <div className="input-wrap">
            <div className="input-box">
              <textarea
                ref={taRef}
                placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
                rows={1}
                value={input}
                onChange={e => { setInput(e.target.value); resize(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              />
              <button className="send" onClick={() => void send()} disabled={!input.trim() || loading}>
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {activeWs && showDocs && (
        <div className="docs-panel">
          <div className="docs-header">
            <span>Documents {docs.length > 0 ? `· ${docs.length}` : ''}</span>
            <button className="tb-icon" style={{ width: 24, height: 24 }} onClick={() => setShowDocs(false)}>
              <X size={12} />
            </button>
          </div>
          <div className="docs-list">
            {docs.length === 0 ? (
              <div style={{ padding: '20px 14px', color: 'var(--text-3)', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                No documents yet.<br />Upload a PDF to begin.
              </div>
            ) : docs.map(d => (
              <div key={d.id} className="doc-row">
                <div className="doc-icon"><DocSVG /></div>
                <div className="doc-info">
                  <div className="doc-name">{d.filename}</div>
                  <div className="doc-size">{fmtBytes(d.size)}</div>
                </div>
                <span className={`status ${d.uploadStatus === 'COMPLETED' ? 'done' : 'proc'}`}>
                  {d.uploadStatus === 'COMPLETED' ? '✓' : '…'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
