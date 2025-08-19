import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  MessageCircle, 
  Calendar, 
  Clock, 
  Edit3,
  CheckCircle,
  AlertCircle,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { chatbotAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ScheduleEditChatbot = ({ 
  schedule, 
  onScheduleUpdate, 
  isOpen = false, 
  onToggle 
}) => {
  // 스케줄별 대화 기록을 저장할 세션 스토리지 키
  const getSessionKey = () => {
    if (!schedule?.schedule_id) return null;
    return `schedule_chat_${schedule.schedule_id}`;
  };

  // 초기 메시지
  const getInitialMessage = () => ({
    id: 1,
    type: 'bot',
    content: '안녕하세요! AI 스케줄 수정 챗봇입니다. 🗓️\n\n현재 생성된 스케줄을 자연어로 수정할 수 있습니다.\n\n📅 **날짜 기반 수정 (가장 정확함):**\n• "26일 미들을 2명으로 추가해줘"\n• "15일 오전을 2명으로 늘려줘"\n• "20일 전체를 휴무로 변경해줘"\n\n📅 **요일 기반 수정:**\n• "월요일 미들을 없애달라" (해당 주만)\n• "화요일 오전을 3명으로 늘려줘" (해당 주만)\n\n👥 **파트/인원 수정:**\n• "26일에 미들 2명을 추가해줘"\n• "15일 야간 파트를 없애달라"\n\n🔍 **고급 자연어 인식:**\n• "평일 전체를 2명씩으로 늘려줘" (월~금)\n• "주말에는 야간 파트를 없애달라" (토,일)\n• "이번 주 월요일 오전에 새 직원 배정해줘"\n• "월~금 미들 파트를 3명으로 늘려줘"\n\n⚠️ **주의사항:**\n• 0명 배정, 빈 파트 생성 등 비논리적인 결과는 자동으로 방지됩니다\n• 구체적인 날짜를 말씀해주시면 더 정확합니다!\n\n📋 **현재 스케줄 기간**: 8월 19일 ~ 9월 15일',
    timestamp: new Date()
  });

  // 세션에서 대화 기록 불러오기
  const loadMessagesFromSession = () => {
    const sessionKey = getSessionKey();
    if (!sessionKey) return [getInitialMessage()];
    
    try {
      const savedMessages = sessionStorage.getItem(sessionKey);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // timestamp를 Date 객체로 변환
        return parsed.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('세션에서 대화 기록 불러오기 실패:', error);
    }
    
    return [getInitialMessage()];
  };

  // 세션에 대화 기록 저장하기
  const saveMessagesToSession = (messages) => {
    const sessionKey = getSessionKey();
    if (!sessionKey) return;
    
    try {
      // timestamp를 문자열로 변환하여 저장
      const messagesToSave = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }));
      sessionStorage.setItem(sessionKey, JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('세션에 대화 기록 저장 실패:', error);
    }
  };

  const [messages, setMessages] = useState(loadMessagesFromSession);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  // 메시지 상태 업데이트 시 세션에 자동 저장
  const updateMessages = (newMessages) => {
    setMessages(newMessages);
    saveMessagesToSession(newMessages);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 스케줄이 변경될 때 대화 기록 초기화
  useEffect(() => {
    if (schedule?.schedule_id) {
      const newMessages = loadMessagesFromSession();
      setMessages(newMessages);
    }
  }, [schedule?.schedule_id]);

  // 스케줄 수정 요청 처리
  const handleScheduleEdit = async (userInput) => {
    if (!schedule) {
      return {
        type: 'error',
        content: '수정할 스케줄이 없습니다. 먼저 스케줄을 생성해주세요.'
      };
    }

    try {
      setLoading(true);
      
      // 백엔드 API를 통한 스케줄 수정 요청
      const response = await chatbotAPI.editSchedule({
        scheduleId: schedule.schedule_id,
        editRequest: userInput,
        currentSchedule: schedule.schedule_data,
        businessId: schedule.business_id
      });
      
      if (response.data.success) {
        const updatedSchedule = response.data.updatedSchedule;
        
        // 부모 컴포넌트에 업데이트된 스케줄 전달
        if (onScheduleUpdate) {
          onScheduleUpdate(updatedSchedule);
        }
        
        return {
          type: 'success',
          content: `스케줄이 성공적으로 수정되었습니다! ✅\n\n${response.data.message || '요청하신 대로 스케줄을 수정했습니다.'}`,
          updatedSchedule: updatedSchedule
        };
      } else {
        return {
          type: 'error',
          content: response.data.message || '스케줄 수정에 실패했습니다. 요청을 다시 확인해주세요.'
        };
      }
    } catch (error) {
      console.error('스케줄 수정 에러:', error);
      return {
        type: 'error',
        content: '스케줄 수정 중 오류가 발생했습니다. 다시 시도해주세요.'
      };
    } finally {
      setLoading(false);
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    updateMessages([...messages, userMessage]);
    setInputMessage('');

    // AI 응답 생성
    const aiResponse = await handleScheduleEdit(inputMessage);
    
    const botMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: aiResponse.content,
      timestamp: new Date(),
      responseType: aiResponse.type
    };

    updateMessages([...messages, userMessage, botMessage]);
  };

  // Enter 키로 메시지 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 현재 스케줄 정보 표시
  const renderCurrentScheduleInfo = () => {
    if (!schedule) return null;

    return (
      <div className="bg-blue-50 p-3 rounded-lg mb-3 border border-blue-200">
        <div className="flex items-center space-x-2 mb-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">현재 스케줄 정보</span>
        </div>
        <div className="text-xs text-blue-700 space-y-1">
          <div>기간: {schedule.week_start_date} ~ {schedule.week_end_date}</div>
          <div>총 직원: {schedule.total_workers || 0}명</div>
          <div>총 시간: {schedule.total_hours || 0}시간</div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-blue-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <span className="font-medium">AI 스케줄 수정</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (confirm('대화 기록을 초기화하시겠습니까?')) {
                const initialMessage = getInitialMessage();
                updateMessages([initialMessage]);
              }
            }}
            className="p-1 hover:bg-blue-700 rounded"
            title="대화 기록 초기화"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-blue-700 rounded"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-blue-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 현재 스케줄 정보 */}
          {renderCurrentScheduleInfo()}

          {/* 메시지 영역 */}
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.responseType === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : message.responseType === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">수정 중...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="스케줄 수정 요청을 입력하세요..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScheduleEditChatbot;
