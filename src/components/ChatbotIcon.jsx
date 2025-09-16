import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import SQLChatbot from './SQLChatbot';
import { useSession } from '../context/SessionContext';

const ChatbotIcon = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { session } = useSession();

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <button 
        onClick={toggleChat}
        className={`chatbot-toggle-button ${isChatOpen ? 'hidden' : ''}`}
        aria-label={isChatOpen ? "Close chatbot" : "Open chatbot"}
      >
        <MessageCircle size={24} />
      </button>
      
      {isChatOpen && <SQLChatbot />}
    </>
  );
};

export default ChatbotIcon;