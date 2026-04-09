

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../src/api";
import "./Chat.css";
import { toast } from "sonner";
import socket from "../Socket";

const AVATAR_COLORS = [
  "#e57373",
  "#f06292",
  "#ba68c8",
  "#7986cb",
  "#4fc3f7",
  "#4db6ac",
  "#81c784",
  "#ffb74d",
  "#ff8a65",
  "#a1887f",
  "#90a4ae",
  "#e53935",
];

function avatarColor(name = "") {
  const code = name?.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function Avatar({ src, name, online = false }) {
  const [imgOk, setImgOk] = useState(Boolean(src));

  const initials = name
    ? name
        .split(" ")
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="chat-avatar-wrapper">
      {imgOk && src ? (
        <img
          className="chat-avatar"
          src={src}
          alt={name || "User"}
          onError={() => setImgOk(false)}
        />
      ) : (
        <div
          className="chat-avatar-fallback"
          style={{ background: avatarColor(name) }}
        >
          {initials}
        </div>
      )}
      {online && <span className="chat-online-dot" />}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "";

  const date = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) return "Yesterday";

  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function MessageStatus({ status }) {
  if (status === "seen") {
    return <span className="message-status seen">✓✓</span>;
  }

  if (status === "delivered") {
    return <span className="message-status delivered">✓✓</span>;
  }

  return <span className="message-status sent">✓</span>;
}

export default function Chat() {
  const user = JSON.parse(localStorage.getItem("chatUser") || "{}");

  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [newChatNumber, setNewChatNumber] = useState("");
  const [startingChat, setStartingChat] = useState(false);

  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load conversations once
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.phoneNumber) return;

      try {
        setLoading(true);
        const res = await api.get(`/conversations/${user.phoneNumber}`);
        setConversations(res.data?.data || []);
      } catch (error) {
        console.log("Failed to fetch conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user?.phoneNumber]);

  // Load messages when a chat opens
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat?.chatUser?.phoneNumber || !user?.phoneNumber) return;

      try {
        setMessagesLoading(true);
        const res = await api.get(
          `/messages/${user.phoneNumber}/${selectedChat.chatUser.phoneNumber}`
        );
        setMessages(res.data?.data || []);
      } catch (error) {
        console.log("Failed to fetch messages:", error);
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [selectedChat?.chatUser?.phoneNumber, user?.phoneNumber]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Join socket + live events
  useEffect(() => {
    if (!user?.phoneNumber) return;

    socket.emit("join_chat", user.phoneNumber);

    const handleReceiveMessage = async (incomingMessage) => {
      const currentChatNumber = selectedChat?.chatUser?.phoneNumber;

      const isCurrentChat =
        currentChatNumber &&
        ((incomingMessage.sender === user.phoneNumber &&
          incomingMessage.receiver === currentChatNumber) ||
          (incomingMessage.sender === currentChatNumber &&
            incomingMessage.receiver === user.phoneNumber));

      const isMyMessage = incomingMessage.sender === user.phoneNumber;

      if (isCurrentChat || isMyMessage) {
        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === incomingMessage._id);
          if (exists) return prev;
          return [...prev, incomingMessage];
        });

        // if message came from the other person in current open chat -> mark seen
        if (
          currentChatNumber &&
          incomingMessage.sender === currentChatNumber &&
          incomingMessage.receiver === user.phoneNumber &&
          incomingMessage._id
        ) {
          try {
            await api.put(`/messages/seen/${incomingMessage._id}`);

            setMessages((prev) =>
              prev.map((msg) =>
                msg._id === incomingMessage._id
                  ? { ...msg, status: "seen" }
                  : msg
              )
            );

            socket.emit("message_seen", {
              messageId: incomingMessage._id,
              sender: incomingMessage.sender,
              receiver: incomingMessage.receiver,
            });
          } catch (error) {
            console.log("Failed to mark seen:", error);
          }
        }
      }

      const otherPhone =
        incomingMessage.sender === user.phoneNumber
          ? incomingMessage.receiver
          : incomingMessage.sender;

      setConversations((prev) => {
        const existingChat = prev.find(
          (chat) => chat?.chatUser?.phoneNumber === otherPhone
        );

        if (!existingChat) return prev;

        const updated = prev.map((chat) =>
          chat?.chatUser?.phoneNumber === otherPhone
            ? {
                ...chat,
                lastMessage: incomingMessage.message,
                lastMessageTime: incomingMessage.timestamp || Date.now(),
                lastMessageAt: incomingMessage.timestamp || Date.now(),
              }
            : chat
        );

        const current = updated.find(
          (chat) => chat?.chatUser?.phoneNumber === otherPhone
        );
        const others = updated.filter(
          (chat) => chat?.chatUser?.phoneNumber !== otherPhone
        );

        return current ? [current, ...others] : updated;
      });
    };

    const handleUserStatus = ({ phoneNumber, lastSeen }) => {
      setConversations((prev) =>
        prev.map((chat) =>
          chat?.chatUser?.phoneNumber === phoneNumber
            ? {
                ...chat,
                chatUser: {
                  ...chat.chatUser,
                  lastSeen,
                },
              }
            : chat
        )
      );

      setSelectedChat((prev) => {
        if (!prev || prev?.chatUser?.phoneNumber !== phoneNumber) return prev;

        return {
          ...prev,
          chatUser: {
            ...prev.chatUser,
            lastSeen,
          },
        };
      });
    };

    const handleTyping = ({ sender }) => {
      if (sender === selectedChat?.chatUser?.phoneNumber) {
        setIsTyping(true);
      }
    };

    const handleStopTyping = ({ sender }) => {
      if (sender === selectedChat?.chatUser?.phoneNumber) {
        setIsTyping(false);
      }
    };

    const handleStatusUpdated = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, status } : msg))
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_status", handleUserStatus);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("message_status_updated", handleStatusUpdated);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_status", handleUserStatus);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("message_status_updated", handleStatusUpdated);
    };
  }, [user?.phoneNumber, selectedChat]);

  const startNewChat = async () => {
    const phone = newChatNumber.trim();

    if (!phone || !user?.phoneNumber || startingChat) return;

    if (phone === user.phoneNumber) {
      toast.error("You can't start a chat with your own number.");
      return;
    }

    const existingChat = conversations.find(
      (chat) => chat?.chatUser?.phoneNumber === phone
    );

    if (existingChat) {
      setSelectedChat(existingChat);
      setNewChatNumber("");
      return;
    }

    try {
      setStartingChat(true);

      const res = await api.get(`/users/${phone}`);
      const foundUser = res.data?.data || res.data?.user;

      if (!foundUser) {
        toast.error("User not found");
        return;
      }

      const newChat = {
        _id: foundUser._id || phone,
        chatUser: foundUser,
        lastMessage: "",
        lastMessageAt: null,
        lastMessageTime: null,
        unreadCount: 0,
      };

      setConversations((prev) => [newChat, ...prev]);
      setSelectedChat(newChat);
      setMessages([]);
      setNewChatNumber("");
    } catch (error) {
      console.log("Failed to start new chat:", error);
      toast.error("User not found");
    } finally {
      setStartingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat?.chatUser?.phoneNumber || sending) {
      return;
    }

    const messageText = newMessage.trim();

    try {
      setSending(true);

      socket.emit("send_message", {
        sender: user.phoneNumber,
        receiver: selectedChat.chatUser.phoneNumber,
        message: messageText,
      });

      setNewMessage("");

      socket.emit("stop_typing", {
        sender: user.phoneNumber,
        receiver: selectedChat.chatUser.phoneNumber,
      });
    } catch (error) {
      console.log("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleTypingChange = (value) => {
    setNewMessage(value);

    if (!selectedChat?.chatUser?.phoneNumber) return;

    socket.emit("typing", {
      sender: user.phoneNumber,
      receiver: selectedChat.chatUser.phoneNumber,
    });

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", {
        sender: user.phoneNumber,
        receiver: selectedChat.chatUser.phoneNumber,
      });
    }, 1200);
  };

  const handleSendOnEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStartChatOnEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      startNewChat();
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const name = conversation?.chatUser?.name || "";
      const phone = conversation?.chatUser?.phoneNumber || "";
      const query = search.toLowerCase();

      return (
        name.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  return (
    <div className={`chat-root${selectedChat ? " chat-open" : ""}`}>
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">Chats</h2>
        </div>

        <div className="chat-new-chat-bar">
          <input
            type="text"
            className="chat-new-chat-input"
            placeholder="Enter phone number"
            value={newChatNumber}
            onChange={(e) => setNewChatNumber(e.target.value)}
            onKeyDown={handleStartChatOnEnter}
          />
          <button
            className="chat-new-chat-btn"
            type="button"
            onClick={startNewChat}
            disabled={startingChat || !newChatNumber.trim()}
          >
            {startingChat ? "..." : "Start"}
          </button>
        </div>

        <div className="chat-search-wrapper">
          <div className="chat-search-inner">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              className="chat-search-input"
              type="text"
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="chat-list">
          {loading && <p className="chat-empty">Loading chats...</p>}

          {!loading && filteredConversations.length === 0 && (
            <p className="chat-empty">No chats yet</p>
          )}

          {!loading &&
            filteredConversations.map((chat) => (
              <div
                key={chat._id}
                className={`chat-item${
                  selectedChat?.chatUser?.phoneNumber ===
                  chat?.chatUser?.phoneNumber
                    ? " active"
                    : ""
                }`}
                onClick={() => setSelectedChat(chat)}
              >
                <Avatar
                  src={chat?.chatUser?.profilePic}
                  name={chat?.chatUser?.name}
                  online={chat?.chatUser?.lastSeen === "online"}
                />

                <div className="chat-item-body">
                  <div className="chat-item-top">
                    <span className="chat-item-name">
                      {chat?.chatUser?.name || "Unknown User"}
                    </span>

                    <span className="chat-item-time">
                      {formatTime(chat?.lastMessageTime || chat?.lastMessageAt)}
                    </span>
                  </div>

                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">
                      {chat?.lastMessage || "No messages yet"}
                    </span>

                    {chat?.unreadCount > 0 && (
                      <span className="chat-unread-badge">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="chat-main">
        {!selectedChat ? (
          <div className="chat-main-placeholder">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Select a chat to start messaging</p>
          </div>
        ) : (
          <div className="chat-selected">
            <div className="chat-selected-header">
              <div className="chat-selected-user">
                <button
                  className="chat-back-btn"
                  type="button"
                  onClick={() => setSelectedChat(null)}
                >
                  ←
                </button>

                <Avatar
                  src={selectedChat?.chatUser?.profilePic}
                  name={selectedChat?.chatUser?.name}
                  online={selectedChat?.chatUser?.lastSeen === "online"}
                />

                <div>
                  <p>{selectedChat?.chatUser?.name || "Unknown User"}</p>
                  <small>
                    {isTyping
                      ? "typing..."
                      : selectedChat?.chatUser?.lastSeen || "offline"}
                  </small>
                </div>
              </div>
            </div>

            <div className="chat-selected-body">
              {messagesLoading && messages.length === 0 ? (
                <p className="chat-message-empty">Loading messages...</p>
              ) : messages.length === 0 ? (
                <p className="chat-message-empty">No messages yet</p>
              ) : (
                messages.map((msg, index) => {
                  const isMe =
                    msg.sender === user.phoneNumber ||
                    msg.sender?.phoneNumber === user.phoneNumber;

                  return (
                    <div
                      key={msg._id || index}
                      className={`chat-bubble-row ${isMe ? "me" : "other"}`}
                    >
                      <div className={`chat-bubble ${isMe ? "me" : "other"}`}>
                        <p>{msg.message}</p>

                        <div className="chat-bubble-meta">
                          <span className="chat-bubble-time">
                            {formatTime(
                              msg.timestamp ||
                                msg.createdAt ||
                                msg.updatedAt ||
                                Date.now()
                            )}
                          </span>

                          {isMe && <MessageStatus status={msg.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isTyping && (
                <div className="chat-typing-row">
                  <div className="chat-typing-bubble">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-bar">
              <textarea
                className="chat-message-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => handleTypingChange(e.target.value)}
                onKeyDown={handleSendOnEnter}
                rows="1"
              />

              <button
                className="chat-send-btn"
                type="button"
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}