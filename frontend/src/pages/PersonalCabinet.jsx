/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import { User, MessageSquare, CheckSquare, Users, BarChart3, Send, Hash, Lock, Plus, ArrowLeft, ChevronRight, Clock, AlertTriangle, Circle, Reply, Search, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

const cls = (...a) => a.filter(Boolean).join(' ');

const roleLabels = { admin: 'Адмiн', manager: 'Менеджер', requisitor: 'Реквiзитор' };
const roleColors = { admin: 'bg-rose-100 text-rose-700', manager: 'bg-sky-100 text-sky-700', requisitor: 'bg-amber-100 text-amber-700' };

const priorityColors = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-slate-400' };
const statusLabels = { todo: 'До виконання', in_progress: 'В роботi', done: 'Виконано' };
const statusColors = { todo: 'bg-slate-100 text-slate-700', in_progress: 'bg-sky-100 text-sky-700', done: 'bg-emerald-100 text-emerald-700' };

/* ========== PROFILE TAB ========== */
function ProfileTab({ profile, stats }) {
  if (!profile) return <div className="p-6 text-center text-corp-text-muted">Завантаження...</div>;
  return (
    <div className="space-y-6" data-testid="profile-tab">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-corp-border p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-corp-primary grid place-content-center text-white text-2xl font-bold flex-shrink-0">
            {(profile.firstname?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-corp-text-dark">{profile.full_name}</h2>
            <span className={cls('inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium', roleColors[profile.role] || 'bg-gray-100 text-gray-700')}>
              {roleLabels[profile.role] || profile.role}
            </span>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-corp-text-main">
              <div><span className="text-corp-text-muted">Email:</span> {profile.email}</div>
              <div><span className="text-corp-text-muted">Логiн:</span> {profile.username}</div>
              <div><span className="text-corp-text-muted">Останній вхід:</span> {profile.last_login ? new Date(profile.last_login).toLocaleString('uk-UA') : 'Невідомо'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Активних задач" value={stats.tasks?.todo + stats.tasks?.in_progress} color="text-sky-600" bg="bg-sky-50" />
          <StatCard label="Виконано задач" value={stats.tasks?.done} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Прострочених" value={stats.tasks?.overdue} color="text-rose-600" bg="bg-rose-50" />
          <StatCard label="Повiдомлень сьогоднi" value={stats.today?.messages_sent} color="text-corp-primary" bg="bg-[#f4f8e6]" />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={cls('rounded-xl p-4 border border-corp-border', bg)}>
      <div className={cls('text-2xl font-bold', color)}>{value || 0}</div>
      <div className="text-xs text-corp-text-muted mt-1">{label}</div>
    </div>
  );
}

/* ========== TASKS TAB ========== */
function TasksTab({ tasks, onRefresh }) {
  const [filter, setFilter] = useState('active');
  const navigate = useNavigate();

  const filtered = tasks.filter(t => {
    if (filter === 'active') return t.status !== 'done';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  const handleStatusChange = async (taskId, newStatus) => {
    await authFetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    onRefresh();
  };

  return (
    <div data-testid="tasks-tab">
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {[['active', 'Активнi'], ['done', 'Виконанi'], ['all', 'Всi']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={cls('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === key ? 'bg-corp-primary text-white' : 'bg-white border border-corp-border text-corp-text-main hover:bg-corp-bg-light'
            )}>
            {label} {key === 'active' ? `(${tasks.filter(t=>t.status!=='done').length})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-corp-text-muted text-sm">
          {filter === 'active' ? 'Немає активних задач' : 'Немає задач'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className="bg-white rounded-lg border border-corp-border p-3 hover:shadow-sm transition-shadow" data-testid={`task-${task.id}`}>
              <div className="flex items-start gap-3">
                {/* Status toggle */}
                <button onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done')}
                  className="mt-0.5 flex-shrink-0">
                  <Circle className={cls('w-5 h-5', task.status === 'done' ? 'text-emerald-500 fill-emerald-500' : task.status === 'in_progress' ? 'text-sky-500' : 'text-slate-300')} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cls('w-2 h-2 rounded-full flex-shrink-0', priorityColors[task.priority])} />
                    <span className={cls('text-sm font-medium', task.status === 'done' ? 'line-through text-corp-text-muted' : 'text-corp-text-dark')}>
                      {task.title}
                    </span>
                  </div>
                  {task.description && <p className="text-xs text-corp-text-muted mt-1 line-clamp-1">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={cls('px-2 py-0.5 rounded-full text-[10px] font-medium', statusColors[task.status])}>{statusLabels[task.status]}</span>
                    {task.order_number && (
                      <button onClick={() => navigate(`/order/${task.order_id}/view`)}
                        className="text-[10px] text-corp-primary hover:underline font-medium">
                        {task.order_number}
                      </button>
                    )}
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-[10px] text-corp-text-muted">
                        <Clock className="w-3 h-3" />
                        {new Date(task.due_date).toLocaleDateString('uk-UA')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== CHAT TAB ========== */
function ChatTab({ currentUserId }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [team, setTeam] = useState([]);
  const [thread, setThread] = useState(null);
  const [threadMsgs, setThreadMsgs] = useState([]);
  const [threadReply, setThreadReply] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChName, setNewChName] = useState('');
  const [newChDesc, setNewChDesc] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const loadChannels = useCallback(async () => {
    const res = await authFetch(`${BACKEND_URL}/api/chat/channels`);
    if (res.ok) setChannels(await res.json());
  }, []);

  const loadTeam = useCallback(async () => {
    const res = await authFetch(`${BACKEND_URL}/api/chat/team`);
    if (res.ok) setTeam(await res.json());
  }, []);

  const loadMessages = useCallback(async (chId) => {
    if (!chId) return;
    setLoadingMsgs(true);
    const res = await authFetch(`${BACKEND_URL}/api/chat/channels/${chId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
    setLoadingMsgs(false);
  }, []);

  useEffect(() => { loadChannels(); loadTeam(); }, [loadChannels, loadTeam]);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);
    // Poll every 5s
    pollRef.current = setInterval(() => {
      loadMessages(activeChannel.id);
      loadChannels();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeChannel, loadMessages, loadChannels]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeChannel) return;
    await authFetch(`${BACKEND_URL}/api/chat/channels/${activeChannel.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: newMsg.trim() }),
    });
    setNewMsg('');
    loadMessages(activeChannel.id);
    loadChannels();
  };

  const sendThreadReply = async () => {
    if (!threadReply.trim() || !thread || !activeChannel) return;
    await authFetch(`${BACKEND_URL}/api/chat/channels/${activeChannel.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: threadReply.trim(), reply_to: thread.id }),
    });
    setThreadReply('');
    // Reload thread
    const res = await authFetch(`${BACKEND_URL}/api/chat/messages/${thread.id}/thread`);
    if (res.ok) setThreadMsgs(await res.json());
    loadMessages(activeChannel.id);
  };

  const openThread = async (msg) => {
    setThread(msg);
    const res = await authFetch(`${BACKEND_URL}/api/chat/messages/${msg.id}/thread`);
    if (res.ok) setThreadMsgs(await res.json());
  };

  const createDm = async (userId) => {
    const res = await authFetch(`${BACKEND_URL}/api/chat/dm/${userId}`, { method: 'POST' });
    if (res.ok) {
      const dm = await res.json();
      setShowNewDm(false);
      loadChannels();
      setActiveChannel(dm);
    }
  };

  const createChannel = async () => {
    if (!newChName.trim()) return;
    const res = await authFetch(`${BACKEND_URL}/api/chat/channels`, {
      method: 'POST', body: JSON.stringify({ name: newChName.trim(), description: newChDesc.trim(), type: 'topic' }),
    });
    if (res.ok) {
      setShowNewChannel(false);
      setNewChName('');
      setNewChDesc('');
      loadChannels();
    }
  };

  const filteredChannels = channels.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const channelIcon = (type) => {
    if (type === 'dm') return <Lock className="w-4 h-4 text-corp-text-muted" />;
    return <Hash className="w-4 h-4 text-corp-text-muted" />;
  };

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-xl border border-corp-border overflow-hidden" data-testid="chat-tab">
      {/* Sidebar */}
      <div className={cls('flex-shrink-0 border-r border-corp-border flex flex-col bg-corp-bg-light',
        activeChannel ? 'hidden sm:flex w-72' : 'w-full sm:w-72'
      )}>
        {/* Search & Actions */}
        <div className="p-3 space-y-2 border-b border-corp-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-corp-text-muted" />
            <input type="text" placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-corp-border bg-white focus:outline-none focus:border-corp-primary"
              data-testid="chat-search" />
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setShowNewChannel(true)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-corp-primary text-white hover:bg-corp-primary-hover transition-colors" data-testid="new-channel-btn">
              <Plus className="w-3.5 h-3.5" /> Канал
            </button>
            <button onClick={() => setShowNewDm(true)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-corp-gold text-white hover:bg-corp-gold-hover transition-colors" data-testid="new-dm-btn">
              <Plus className="w-3.5 h-3.5" /> Особисте
            </button>
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChannels.map(ch => (
            <button key={ch.id} onClick={() => { setActiveChannel(ch); setThread(null); }}
              className={cls('w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/80 transition-colors border-b border-corp-border/50',
                activeChannel?.id === ch.id && 'bg-white shadow-sm'
              )} data-testid={`channel-${ch.id}`}>
              {channelIcon(ch.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-corp-text-dark truncate">{ch.name}</span>
                  {ch.unread > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-corp-primary text-white text-[10px] grid place-content-center font-bold flex-shrink-0">{ch.unread}</span>
                  )}
                </div>
                {ch.last_message && (
                  <p className="text-[11px] text-corp-text-muted truncate mt-0.5">
                    <span className="font-medium">{ch.last_message.user_name?.split(' ')[0]}:</span> {ch.last_message.text}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cls('flex-1 flex flex-col', !activeChannel && 'hidden sm:flex')}>
        {activeChannel ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-corp-border flex items-center gap-3 bg-white">
              <button onClick={() => setActiveChannel(null)} className="sm:hidden">
                <ArrowLeft className="w-5 h-5 text-corp-text-main" />
              </button>
              {channelIcon(activeChannel.type)}
              <div>
                <div className="text-sm font-semibold text-corp-text-dark">{activeChannel.name}</div>
                {activeChannel.description && <div className="text-[11px] text-corp-text-muted">{activeChannel.description}</div>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-corp-bg-light/50">
              {messages.map(msg => (
                <div key={msg.id} className={cls('flex gap-2.5', msg.user_id === currentUserId && 'flex-row-reverse')} data-testid={`message-${msg.id}`}>
                  <div className={cls('w-8 h-8 rounded-full grid place-content-center text-xs font-bold flex-shrink-0',
                    msg.user_id === currentUserId ? 'bg-corp-primary text-white' : 'bg-corp-gold text-white'
                  )}>
                    {(msg.user_name?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className={cls('max-w-[75%] rounded-xl px-3 py-2',
                    msg.user_id === currentUserId ? 'bg-corp-primary/10 rounded-tr-sm' : 'bg-white border border-corp-border rounded-tl-sm'
                  )}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-corp-text-dark">{msg.user_name}</span>
                      <span className={cls('px-1.5 py-0 rounded text-[9px] font-medium', roleColors[msg.user_role])}>{roleLabels[msg.user_role] || msg.user_role}</span>
                      <span className="text-[10px] text-corp-text-muted">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <p className="text-sm text-corp-text-dark whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => openThread(msg)} className="flex items-center gap-1 text-[10px] text-corp-text-muted hover:text-corp-primary transition-colors" data-testid={`thread-btn-${msg.id}`}>
                        <Reply className="w-3 h-3" />
                        {msg.thread_count > 0 ? `${msg.thread_count} вiдповiдей` : 'Вiдповiсти'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-corp-border bg-white">
              <div className="flex items-center gap-2">
                <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Написати повiдомлення..."
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-corp-border bg-corp-bg-light focus:outline-none focus:border-corp-primary focus:bg-white transition-colors"
                  data-testid="chat-input" />
                <button onClick={sendMessage}
                  className="p-2.5 rounded-xl bg-corp-primary text-white hover:bg-corp-primary-hover transition-colors disabled:opacity-50"
                  disabled={!newMsg.trim()} data-testid="chat-send-btn">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-content-center text-corp-text-muted text-sm">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Оберiть канал для спiлкування</p>
          </div>
        )}
      </div>

      {/* Thread Panel */}
      {thread && (
        <div className="w-80 border-l border-corp-border flex flex-col bg-white hidden lg:flex">
          <div className="px-4 py-3 border-b border-corp-border flex items-center justify-between">
            <div className="text-sm font-semibold text-corp-text-dark">Тред</div>
            <button onClick={() => setThread(null)} className="p-1 hover:bg-corp-bg-light rounded">
              <X className="w-4 h-4 text-corp-text-muted" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {threadMsgs.map(msg => (
              <div key={msg.id} className={cls('rounded-lg px-3 py-2', msg.is_parent ? 'bg-corp-bg-light border border-corp-border' : 'bg-white border border-corp-border/50')}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-corp-text-dark">{msg.user_name}</span>
                  <span className="text-[10px] text-corp-text-muted">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <p className="text-sm text-corp-text-dark">{msg.message}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-corp-border">
            <div className="flex items-center gap-2">
              <input type="text" value={threadReply} onChange={e => setThreadReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendThreadReply())}
                placeholder="Вiдповiсти в тред..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-corp-border focus:outline-none focus:border-corp-primary"
                data-testid="thread-input" />
              <button onClick={sendThreadReply} className="p-2 rounded-lg bg-corp-primary text-white hover:bg-corp-primary-hover disabled:opacity-50" disabled={!threadReply.trim()}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Channel Modal */}
      {showNewChannel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewChannel(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()} data-testid="new-channel-modal">
            <h3 className="text-lg font-semibold text-corp-text-dark mb-4">Новий канал</h3>
            <input type="text" value={newChName} onChange={e => setNewChName(e.target.value)} placeholder="Назва каналу"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-corp-border mb-3 focus:outline-none focus:border-corp-primary" data-testid="new-channel-name" />
            <input type="text" value={newChDesc} onChange={e => setNewChDesc(e.target.value)} placeholder="Опис (необов'язково)"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-corp-border mb-4 focus:outline-none focus:border-corp-primary" />
            <div className="flex gap-2">
              <button onClick={() => setShowNewChannel(false)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-corp-border text-corp-text-main hover:bg-corp-bg-light">Скасувати</button>
              <button onClick={createChannel} className="flex-1 px-3 py-2 text-sm rounded-lg bg-corp-primary text-white hover:bg-corp-primary-hover" data-testid="create-channel-btn">Створити</button>
            </div>
          </div>
        </div>
      )}

      {/* New DM Modal */}
      {showNewDm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewDm(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()} data-testid="new-dm-modal">
            <h3 className="text-lg font-semibold text-corp-text-dark mb-4">Особисте повiдомлення</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {team.filter(m => m.id !== currentUserId).map(m => (
                <button key={m.id} onClick={() => createDm(m.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-corp-bg-light flex items-center gap-3 transition-colors" data-testid={`dm-user-${m.id}`}>
                  <div className="w-8 h-8 rounded-full bg-corp-gold grid place-content-center text-white text-xs font-bold">
                    {(m.name?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-corp-text-dark">{m.name}</div>
                    <div className="text-[11px] text-corp-text-muted">{roleLabels[m.role] || m.role}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowNewDm(false)} className="mt-3 w-full px-3 py-2 text-sm rounded-lg border border-corp-border text-corp-text-main hover:bg-corp-bg-light">Скасувати</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== TEAM TAB ========== */
function TeamTab({ teamData }) {
  if (!teamData?.length) return <div className="p-6 text-center text-corp-text-muted">Завантаження...</div>;
  return (
    <div className="space-y-2" data-testid="team-tab">
      {teamData.map(m => (
        <div key={m.user_id} className="bg-white rounded-lg border border-corp-border p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-corp-gold grid place-content-center text-white font-bold flex-shrink-0">
            {(m.name?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-corp-text-dark">{m.name}</span>
              <span className={cls('px-2 py-0.5 rounded-full text-[10px] font-medium', roleColors[m.role])}>{roleLabels[m.role]}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-corp-text-muted">
              <span>Активних задач: <b className="text-corp-text-dark">{m.active_tasks}</b></span>
              <span>Виконано сьогоднi: <b className="text-emerald-600">{m.done_today}</b></span>
              {m.last_login && <span>Останній вхід: {new Date(m.last_login).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function PersonalCabinet() {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  const currentUserId = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.user_id || u.id;
    } catch { return null; }
  })();

  const loadProfile = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/cabinet/profile`);
      if (res.ok) setProfile(await res.json());
      else console.error('[Cabinet] Profile error:', res.status);
    } catch (e) { console.error('[Cabinet] Profile fetch error:', e); }
  };

  const loadStats = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/cabinet/stats`);
      if (res.ok) setStats(await res.json());
      else console.error('[Cabinet] Stats error:', res.status);
    } catch (e) { console.error('[Cabinet] Stats fetch error:', e); }
  };

  const loadTasks = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/cabinet/my-tasks`);
      if (res.ok) setTasks(await res.json());
      else console.error('[Cabinet] Tasks error:', res.status);
    } catch (e) { console.error('[Cabinet] Tasks fetch error:', e); }
  };

  const loadTeam = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/cabinet/team`);
      if (res.ok) setTeamData(await res.json());
      else console.error('[Cabinet] Team error:', res.status);
    } catch (e) { console.error('[Cabinet] Team fetch error:', e); }
  };

  const loadUnread = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/chat/unread`);
      if (res.ok) {
        const d = await res.json();
        setUnread(d.unread || 0);
      }
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    console.log('[Cabinet] Mounting, loading data...');
    loadProfile();
    loadStats();
    loadTasks();
    loadTeam();
    loadUnread();
    const interval = setInterval(loadUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { key: 'profile', label: 'Профiль', icon: User },
    { key: 'tasks', label: 'Мої задачi', icon: CheckSquare, count: tasks.filter(t => t.status !== 'done').length },
    { key: 'chat', label: 'Чат', icon: MessageSquare, count: unread },
    { key: 'team', label: 'Команда', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-corp-bg-page" data-testid="personal-cabinet">
      <CorporateHeader cabinetName="Особистий кабiнет" showBackButton onBackClick={() => navigate('/manager')} />

      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-5 bg-white rounded-xl p-1.5 border border-corp-border overflow-x-auto" data-testid="cabinet-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cls(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.key
                    ? 'bg-corp-primary text-white shadow-sm'
                    : 'text-corp-text-main hover:bg-corp-bg-light'
                )} data-testid={`tab-${tab.key}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cls(
                    'w-5 h-5 rounded-full text-[10px] grid place-content-center font-bold',
                    activeTab === tab.key ? 'bg-white text-corp-primary' : 'bg-corp-primary text-white'
                  )}>{tab.count > 99 ? '99+' : tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && <ProfileTab profile={profile} stats={stats} />}
        {activeTab === 'tasks' && <TasksTab tasks={tasks} onRefresh={() => { loadTasks(); loadStats(); }} />}
        {activeTab === 'chat' && <ChatTab currentUserId={currentUserId} />}
        {activeTab === 'team' && <TeamTab teamData={teamData} />}
      </div>
    </div>
  );
}
