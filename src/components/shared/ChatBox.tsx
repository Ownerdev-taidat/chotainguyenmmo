'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, ChevronLeft, User as UserIcon, Shield, Store, Loader2, Image as ImageIcon, Check, CheckCheck, Eye, X, Package, ShoppingBag } from 'lucide-react';
import { useUI } from './UIProvider';
import { secureFetch } from '@/lib/secure-fetch';

interface Conversation {
    id: string;
    partnerId: string;
    partnerName: string;
    partnerType: 'admin' | 'shop' | 'user';
    partnerAvatar: string | null;
    lastMessage: string;
    lastMessageAt: string;
    unread: number;
}

interface Message {
    id: string;
    senderId: string;
    content: string;
    type: 'text' | 'image';
    timestamp: string;
    isMe: boolean;
    status: 'sent' | 'delivered' | 'seen';
}

interface ContextCard {
    type: 'product' | 'order';
    id: string;
    name?: string;
    price?: number;
    image?: string;
    code?: string;
}

interface ChatBoxProps {
    initialPartnerId?: string | null;
    contextCard?: ContextCard;
    title?: string;
    subtitle?: string;
    roleLabelMe?: string;
    roleLabelPartner?: (type: string) => string;
}

export default function ChatBox({
    initialPartnerId,
    contextCard,
    title = 'Tin nhắn',
    subtitle = 'Trao đổi tin nhắn.',
    roleLabelPartner = (type) => type === 'admin' ? '🛡️ Admin' : type === 'shop' ? '🏪 Shop' : '🛒 Khách hàng',
}: ChatBoxProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activePartnerId, setActivePartnerId] = useState<string | null>(initialPartnerId || null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [loadingConvos, setLoadingConvos] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMobileList, setShowMobileList] = useState(true);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [contextDismissed, setContextDismissed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevMsgCountRef = useRef(0);
    const { showToast } = useUI();

    // Load conversation list
    const loadConversations = useCallback(async () => {
        try {
            const res = await secureFetch('/api/v1/conversations');
            if (!res.ok) { setLoadingConvos(false); return; }
            const data = await res.json();
            if (data.success) {
                let convos: Conversation[] = data.data;
                if (!convos.find(c => c.partnerId === 'admin')) {
                    convos = [{
                        id: 'admin-default', partnerId: 'admin',
                        partnerName: 'ChoTaiNguyen Support', partnerType: 'admin',
                        partnerAvatar: null, lastMessage: '', lastMessageAt: new Date().toISOString(), unread: 0,
                    }, ...convos];
                }
                setConversations(convos);
            }
        } catch {}
        setLoadingConvos(false);
    }, []);

    // Load messages for active conversation
    const loadMessages = useCallback(async (partnerId: string, silent = false) => {
        if (!silent) setLoadingMessages(true);
        try {
            const res = await secureFetch(`/api/v1/conversations?partnerId=${partnerId}`);
            if (!res.ok) { if (!silent) setLoadingMessages(false); return; }
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
                if (data.conversationId) setConversationId(data.conversationId);

                // Auto-mark as read
                if (data.conversationId && data.data.length > 0) {
                    const lastMsg = data.data[data.data.length - 1];
                    secureFetch('/api/v1/conversations', {
                        method: 'PATCH',
                        body: JSON.stringify({ conversationId: data.conversationId, lastMessageId: lastMsg.id }),
                    }).then(() => {
                        setConversations(prev => prev.map(c =>
                            c.id === data.conversationId ? { ...c, unread: 0 } : c
                        ));
                    }).catch(() => {});
                }
            }
        } catch {}
        if (!silent) setLoadingMessages(false);
    }, []);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    // Auto-select initial partner or first conversation
    useEffect(() => {
        if (loadingConvos) return;
        if (initialPartnerId && !activePartnerId) {
            setActivePartnerId(initialPartnerId);
            loadMessages(initialPartnerId);
            setShowMobileList(false);
        } else if (!activePartnerId && conversations.length > 0) {
            setActivePartnerId(conversations[0].partnerId);
            loadMessages(conversations[0].partnerId);
        }
    }, [loadingConvos, initialPartnerId]);

    // Real-time polling — 2s for messages, 5s for conversation list
    useEffect(() => {
        if (!activePartnerId) return;
        const msgInterval = setInterval(() => loadMessages(activePartnerId, true), 2000);
        const convInterval = setInterval(() => loadConversations(), 5000);
        return () => { clearInterval(msgInterval); clearInterval(convInterval); };
    }, [activePartnerId, loadMessages, loadConversations]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMsgCountRef.current = messages.length;
    }, [messages.length]);

    // Send text message
    const handleSend = async () => {
        if ((!messageInput.trim() && !imagePreview) || !activePartnerId || sending) return;
        setSending(true);
        try {
            const body: any = { partnerId: activePartnerId };
            if (imagePreview) {
                body.imageUrl = imagePreview;
            } else {
                body.message = messageInput.trim();
            }
            const res = await secureFetch('/api/v1/conversations', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => [...prev, data.data]);
                setMessageInput('');
                setImagePreview(null);
                loadConversations();
            }
        } catch {}
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Send context card as formatted text message
    const handleSendContext = async () => {
        if (!contextCard || !activePartnerId || sending) return;
        setSending(true);
        let msg = '';
        if (contextCard.type === 'product') {
            msg = `📦 Hỏi về sản phẩm: ${contextCard.name}${contextCard.price ? ` \n💰 Giá: ${contextCard.price.toLocaleString('vi-VN')}đ` : ''}`;
        } else {
            msg = `📦 Hỏi về đơn hàng: ${contextCard.code || contextCard.id}`;
        }
        try {
            const res = await secureFetch('/api/v1/conversations', {
                method: 'POST',
                body: JSON.stringify({ partnerId: activePartnerId, message: msg }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => [...prev, data.data]);
                setContextDismissed(true);
                loadConversations();
            }
        } catch {}
        setSending(false);
    };

    // Image upload
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Ảnh tối đa 5MB', 'warning'); return; }
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const selectConversation = (conv: Conversation) => {
        setActivePartnerId(conv.partnerId);
        loadMessages(conv.partnerId);
        setShowMobileList(false);
    };

    const activeConv = conversations.find(c => c.partnerId === activePartnerId);
    const filteredConvs = conversations.filter(c => !searchQuery || c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()));

    const fmtTime = (d: string) => {
        try {
            const date = new Date(d);
            const now = new Date();
            const hrs = String(date.getHours()).padStart(2, '0');
            const mins = String(date.getMinutes()).padStart(2, '0');
            if (date.toDateString() === now.toDateString()) return `${hrs}:${mins}`;
            return `${date.getDate()}/${date.getMonth() + 1} ${hrs}:${mins}`;
        } catch { return ''; }
    };

    const getAvatarBg = (type: string) => type === 'admin' ? 'from-brand-danger to-red-600' : type === 'shop' ? 'from-emerald-500 to-green-600' : 'from-brand-info to-blue-500';
    const getIcon = (type: string) => type === 'admin' ? <Shield className="w-3 h-3 text-brand-danger" /> : type === 'shop' ? <Store className="w-3 h-3 text-emerald-500" /> : <UserIcon className="w-3 h-3 text-brand-info" />;

    // Status icon
    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'seen') return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
        if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-brand-text-muted/50" />;
        return <Check className="w-3.5 h-3.5 text-brand-text-muted/50" />;
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{title}</h1>
                <p className="text-sm text-brand-text-muted">{subtitle}</p>
            </div>

            <div className="card !p-0 overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
                <div className="flex h-full">
                    {/* Conversation List */}
                    <div className={`w-full md:w-[320px] border-r border-brand-border flex flex-col shrink-0 ${activePartnerId && !showMobileList ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-3 border-b border-brand-border">
                            <h3 className="text-sm font-semibold text-brand-text-primary mb-2">HỘI THOẠI</h3>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm kiếm..." className="input-field !py-1.5 !pl-9 text-xs" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {loadingConvos ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-brand-primary" /></div>
                            ) : filteredConvs.length === 0 ? (
                                <div className="text-center py-10 text-sm text-brand-text-muted">Chưa có hội thoại</div>
                            ) : (
                                filteredConvs.map(conv => (
                                    <button key={conv.partnerId} onClick={() => selectConversation(conv)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-surface-2 transition-colors text-left border-b border-brand-border/20 ${activePartnerId === conv.partnerId ? 'bg-brand-primary/5 border-l-2 border-l-brand-primary' : ''}`}>
                                        <div className="relative shrink-0">
                                            {conv.partnerAvatar ? (
                                                <img src={conv.partnerAvatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarBg(conv.partnerType)} flex items-center justify-center`}>
                                                    <span className="text-white text-xs font-bold">{conv.partnerName.charAt(0)}</span>
                                                </div>
                                            )}
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-brand-success rounded-full border-2 border-brand-surface" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm truncate ${conv.unread > 0 ? 'font-bold text-brand-text-primary' : 'font-medium text-brand-text-primary'}`}>{conv.partnerName}</span>
                                                {getIcon(conv.partnerType)}
                                            </div>
                                            <p className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? 'font-semibold text-brand-text-primary' : 'text-brand-text-muted'}`}>{conv.lastMessage || 'Chưa có tin nhắn'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="text-[10px] text-brand-text-muted whitespace-nowrap">{fmtTime(conv.lastMessageAt)}</span>
                                            {conv.unread > 0 && (
                                                <span className="min-w-[18px] h-[18px] rounded-full bg-brand-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
                                                    {conv.unread > 99 ? '99+' : conv.unread}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className={`flex-1 flex flex-col ${!activePartnerId || showMobileList ? 'hidden md:flex' : 'flex'}`}>
                        {(activeConv || activePartnerId) ? (
                            <>
                                {/* Chat Header */}
                                <div className="px-4 py-3 border-b border-brand-border flex items-center gap-3 bg-brand-surface">
                                    <button onClick={() => setShowMobileList(true)} className="md:hidden p-1 rounded-lg hover:bg-brand-surface-2">
                                        <ChevronLeft className="w-5 h-5 text-brand-text-muted" />
                                    </button>
                                    {activeConv?.partnerAvatar ? (
                                        <img src={activeConv.partnerAvatar} className="w-9 h-9 rounded-full object-cover" alt="" />
                                    ) : (
                                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarBg(activeConv?.partnerType || 'shop')} flex items-center justify-center`}>
                                            <span className="text-white text-xs font-bold">{(activeConv?.partnerName || activePartnerId || '?').charAt(0)}</span>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold text-brand-text-primary">{activeConv?.partnerName || 'Cuộc trò chuyện mới'}</span>
                                            {getIcon(activeConv?.partnerType || 'shop')}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-brand-success" />
                                            <span className="text-[11px] text-brand-success font-medium">Online</span>
                                            <span className="text-[11px] text-brand-text-muted ml-1">{roleLabelPartner(activeConv?.partnerType || 'shop')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: 'linear-gradient(180deg, var(--brand-surface-2) 0%, var(--brand-surface) 100%)' }}>
                                    {loadingMessages ? (
                                        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-brand-primary" /></div>
                                    ) : messages.length === 0 ? (
                                        <div className="text-center py-10">
                                            <div className="w-14 h-14 rounded-full bg-brand-surface-2 flex items-center justify-center mx-auto mb-3">
                                                <Send className="w-6 h-6 text-brand-text-muted/30" />
                                            </div>
                                            <p className="text-sm text-brand-text-muted">Bắt đầu cuộc trò chuyện!</p>
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const showDate = idx === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1].timestamp).toDateString();
                                            return (
                                                <div key={msg.id}>
                                                    {showDate && (
                                                        <div className="flex justify-center my-3">
                                                            <span className="text-[10px] bg-brand-surface-2 text-brand-text-muted px-3 py-1 rounded-full">
                                                                {new Date(msg.timestamp).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[75%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                            {msg.type === 'image' ? (
                                                                <div className={`rounded-2xl overflow-hidden border border-brand-border/20 ${msg.isMe ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                                                                    <img src={msg.content} alt="Ảnh" className="max-w-[300px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.content, '_blank')} />
                                                                </div>
                                                            ) : (
                                                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.isMe
                                                                    ? 'bg-gradient-to-br from-brand-primary to-blue-600 text-white rounded-br-md shadow-sm'
                                                                    : 'bg-white dark:bg-brand-surface-2 text-brand-text-primary rounded-bl-md shadow-sm border border-brand-border/20'
                                                                }`}>
                                                                    {msg.content}
                                                                </div>
                                                            )}
                                                            <div className={`flex items-center gap-1 mt-0.5 ${msg.isMe ? 'justify-end' : ''}`}>
                                                                <span className="text-[10px] text-brand-text-muted">{fmtTime(msg.timestamp)}</span>
                                                                {msg.isMe && <StatusIcon status={msg.status} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Image Preview */}
                                {imagePreview && (
                                    <div className="px-4 py-2 border-t border-brand-border bg-brand-surface-2 flex items-center gap-3">
                                        <div className="relative">
                                            <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-brand-border" />
                                            <button onClick={() => setImagePreview(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-danger rounded-full flex items-center justify-center">
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                        <span className="text-xs text-brand-text-muted">Ảnh sẵn sàng gửi</span>
                                    </div>
                                )}

                                {/* Context Card — Product/Order suggestion */}
                                {contextCard && !contextDismissed && (
                                    <div className="px-4 py-2.5 border-t border-brand-border bg-gradient-to-r from-brand-primary/5 to-blue-500/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${contextCard.type === 'product' ? 'bg-brand-primary/10' : 'bg-emerald-500/10'}`}>
                                                {contextCard.type === 'product'
                                                    ? (contextCard.image
                                                        ? <img src={contextCard.image} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                                        : <Package className="w-5 h-5 text-brand-primary" />)
                                                    : <ShoppingBag className="w-5 h-5 text-emerald-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-brand-text-muted">
                                                    {contextCard.type === 'product' ? '📦 Sản phẩm' : '📃 Đơn hàng'}
                                                </p>
                                                <p className="text-sm font-medium text-brand-text-primary truncate">
                                                    {contextCard.type === 'product' ? contextCard.name : `#${contextCard.code || contextCard.id}`}
                                                </p>
                                                {contextCard.price && (
                                                    <p className="text-xs font-semibold text-brand-primary">{contextCard.price.toLocaleString('vi-VN')}đ</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleSendContext}
                                                disabled={sending}
                                                className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                                            >
                                                Gửi
                                            </button>
                                            <button
                                                onClick={() => setContextDismissed(true)}
                                                className="p-1 rounded-lg hover:bg-brand-surface-2 shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5 text-brand-text-muted" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Input Bar */}
                                <div className="p-3 border-t border-brand-border bg-brand-surface">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-brand-surface-2 text-brand-text-muted hover:text-brand-primary transition-colors" title="Gửi ảnh">
                                            <ImageIcon className="w-5 h-5" />
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                        <input
                                            type="text"
                                            value={messageInput}
                                            onChange={e => setMessageInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={imagePreview ? 'Bấm gửi để gửi ảnh...' : 'Nhập tin nhắn...'}
                                            className="flex-1 bg-brand-surface-2 border border-brand-border rounded-full px-4 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                                        />
                                        <button onClick={handleSend} disabled={(!messageInput.trim() && !imagePreview) || sending}
                                            className="p-2.5 rounded-full bg-brand-primary text-white hover:brightness-110 transition-all disabled:opacity-40 shadow-sm">
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full bg-brand-surface-2 flex items-center justify-center mx-auto mb-4">
                                        <Send className="w-7 h-7 text-brand-text-muted/40" />
                                    </div>
                                    <h3 className="text-base font-semibold text-brand-text-primary mb-1">Chọn cuộc trò chuyện</h3>
                                    <p className="text-sm text-brand-text-muted">Bắt đầu nhắn tin bằng cách chọn hội thoại bên trái.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
