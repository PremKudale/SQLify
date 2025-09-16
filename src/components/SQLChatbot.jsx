'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Minimize2, AlertCircle } from 'lucide-react';
import '../chatbot.css'; // Import the CSS file

const GEMINI_API_KEY = 'AIzaSyBg9C3nn6ehGFeajN08hA0AK0FVzyuKGL8'; // Replace with your actual key

export default function SQLChatbot() {
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sql-chatbot-messages');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const SQL_SYSTEM_PROMPT = `
  You are an expert SQL assistant. Follow these rules:
  1. Only answer SQL-related questions
  2. Provide concise answers (5-10 lines maximum)
  3. For non-SQL questions, respond: "I specialize in SQL topics only"
  `;

  useEffect(() => {
    localStorage.setItem('sql-chatbot-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    setError(null);
    const userMessage = { sender: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${SQL_SYSTEM_PROMPT}\n\nQuestion: ${input}\n\nPlease provide a concise answer (5-10 lines maximum).` }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500,
              topP: 0.95
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const botResponse = data.candidates[0]?.content?.parts[0]?.text || 
                         "I couldn't generate a response.";
      
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: botResponse,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('sql-chatbot-messages');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="chatbot-toggle-button"
        aria-label="Open chatbot"
      >
        <Bot size={24} />
      </button>
    );
  }

  return (
    <div className="chatbot-container">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-title">
          <Bot size={20} />
          <h2>SQL Assistant</h2>
        </div>
        <div className="chatbot-controls">
          <button 
            onClick={clearChat}
            className="chatbot-control-button"
            title="Clear chat"
          >
            <X size={18} />
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="chatbot-control-button"
            title="Minimize"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="chatbot-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Messages container */}
      <div 
        ref={messagesContainerRef}
        className="chatbot-messages"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`chatbot-message ${msg.sender}`}>
            <div className="chatbot-message-content">
              {msg.sender === 'bot' ? (
                <Bot size={20} className="chatbot-message-icon" />
              ) : (
                <User size={20} className="chatbot-message-icon" />
              )}
              <div className="chatbot-message-bubble">
                <div className="chatbot-message-text">{msg.text}</div>
                <div className="chatbot-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="chatbot-message bot">
            <div className="chatbot-message-content">
              <Bot size={20} className="chatbot-message-icon" />
              <div className="chatbot-message-bubble">
                <div className="chatbot-loading">
                  <div className="chatbot-loading-dot"></div>
                  <div className="chatbot-loading-dot"></div>
                  <div className="chatbot-loading-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="chatbot-scroll-anchor" />
      </div>

      {/* Input area */}
      <div className="chatbot-input-container">
        <div className="chatbot-input-wrapper">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask a SQL question..."
            className="chatbot-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="chatbot-send-button"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}