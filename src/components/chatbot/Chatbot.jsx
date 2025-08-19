/**
 * AI 스케줄 생성 챗봇 컴포넌트
 * 자연어로 스케줄을 생성하고 관리할 수 있는 지능형 챗봇
 * 예약 관련 문의, 서비스 안내, FAQ, 스케줄 생성 등을 처리
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { chatbotAPI } from '../../services/api';
import { 
  ChevronLeft, 
  Send,
  Bot,
  User,
  MessageCircle,
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const Chatbot = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: '안녕하세요! AI 스케줄 생성 챗봇입니다. 🗓️\n\n스케줄을 생성하거나 예약 관련 문의를 도와드릴 수 있습니다.\n\n예시:\n• "내일 오후 2시에 미용실 예약하고 싶어요"\n• "이번 주 금요일 저녁 7시에 식당 예약 가능한가요?"\n• "다음 주 월요일 오전 10시에 상담 예약해주세요"',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedSchedules, setSuggestedSchedules] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 스케줄 생성 AI 로직
  const generateSchedule = async (userInput) => {
    try {
      // 백엔드 API를 통한 스케줄 파싱
      const response = await chatbotAPI.parseScheduleRequest(userInput);
      
      if (response.data.success) {
        const scheduleInfo = response.data.schedule;
        const suggestedSchedule = {
          id: Date.now(),
          date: scheduleInfo.date,
          time: scheduleInfo.time,
          service: scheduleInfo.service,
          duration: scheduleInfo.duration || '1시간',
          status: 'suggested'
        };
        
        setSuggestedSchedules(prev => [...prev, suggestedSchedule]);
        
        return {
          type: 'schedule_suggestion',
          content: `스케줄을 생성했습니다! 📅\n\n📅 날짜: ${scheduleInfo.date}\n⏰ 시간: ${scheduleInfo.time}\n🎯 서비스: ${scheduleInfo.service}\n⏱️ 소요시간: ${scheduleInfo.duration}\n\n이 스케줄로 예약하시겠습니까?`,
          schedule: suggestedSchedule
        };
      } else {
        return {
          type: 'error',
          content: response.data.message || '스케줄을 생성할 수 없습니다. 날짜와 시간을 정확히 입력해주세요.'
        };
      }
    } catch (error) {
      console.error('스케줄 생성 에러:', error);
      return {
        type: 'error',
        content: '스케줄 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
      };
    }
  };



  // 스케줄 확정
  const confirmSchedule = async (schedule) => {
    try {
      // 실제 예약 API 호출
      const response = await chatbotAPI.createBooking({
        date: schedule.date,
        time: schedule.time,
        service: schedule.service,
        userId: currentUser?.uid
      });

      setSuggestedSchedules(prev => 
        prev.map(s => 
          s.id === schedule.id 
            ? { ...s, status: 'confirmed' }
            : s
        )
      );

      return {
        type: 'confirmation',
        content: `✅ 예약이 완료되었습니다!\n\n📅 ${schedule.date}\n⏰ ${schedule.time}\n🎯 ${schedule.service}\n\n예약 번호: ${response.data.bookingId}\n\n예약 변경이나 취소는 고객센터로 연락해주세요.`
      };
    } catch (error) {
      return {
        type: 'error',
        content: '예약 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      };
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

          try {
        // 스케줄 생성 시도
        const scheduleResult = await generateSchedule(inputMessage);
        
        if (scheduleResult && scheduleResult.type === 'schedule_suggestion') {
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            content: scheduleResult.content,
            timestamp: new Date(),
            schedule: scheduleResult.schedule
          };
          setMessages(prev => [...prev, botMessage]);
        } else if (scheduleResult && scheduleResult.type === 'error') {
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            content: scheduleResult.content,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
        } else {
          // 일반 챗봇 응답
          const response = await chatbotAPI.sendMessage(inputMessage);
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            content: response.data.response,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
        }
      } catch (error) {
        toast.error('메시지 전송 중 오류가 발생했습니다.');
        console.error('챗봇 에러:', error);
      } finally {
        setLoading(false);
      }
  };

  // 스케줄 확정 처리
  const handleConfirmSchedule = async (schedule) => {
    setLoading(true);
    
    try {
      const result = await confirmSchedule(schedule);
      const botMessage = {
        id: Date.now(),
        type: 'bot',
        content: result.content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      toast.error('예약 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const quickReplies = [
    '내일 오후 2시 미용실 예약',
    '이번 주 금요일 저녁 7시 식당 예약',
    '다음 주 월요일 오전 10시 상담',
    '예약 방법',
    '예약 취소',
    '영업시간'
  ];

  const handleQuickReply = (reply) => {
    setInputMessage(reply);
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                뒤로
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                AI 스케줄 챗봇
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Bot className="h-6 w-6 text-blue-500" />
              <span className="text-sm text-gray-600">AI 스케줄 생성</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'bot' && (
                      <Bot className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-line">{message.content}</p>
                      
                      {/* 스케줄 제안 버튼 */}
                      {message.schedule && (
                        <div className="mt-3 space-y-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">제안된 스케줄</span>
                            </div>
                            <div className="text-xs text-blue-800 space-y-1">
                              <div>📅 {message.schedule.date}</div>
                              <div>⏰ {message.schedule.time}</div>
                              <div>🎯 {message.schedule.service}</div>
                              <div>⏱️ {message.schedule.duration}</div>
                            </div>
                            <button
                              onClick={() => handleConfirmSchedule(message.schedule)}
                              className="mt-3 w-full bg-blue-600 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              <span>이 스케줄로 예약하기</span>
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <p className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <User className="h-4 w-4 text-blue-100 mt-1 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* 빠른 답변 */}
          {messages.length === 1 && (
            <div className="px-4 py-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">빠른 예약:</p>
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickReply(reply)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 입력 영역 */}
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="스케줄을 자연어로 입력하세요... (예: 내일 오후 2시 미용실 예약)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* AI 스케줄 챗봇 안내 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
            <Bot className="h-4 w-4 mr-1" />
            AI 스케줄 생성 챗봇
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• 자연어로 스케줄을 생성할 수 있습니다</li>
            <li>• "내일 오후 2시 미용실 예약" 같은 표현으로 입력하세요</li>
            <li>• 날짜, 시간, 서비스를 자동으로 인식합니다</li>
            <li>• 예약 관련 문의도 함께 도와드립니다</li>
            <li>• 24시간 언제든지 이용 가능합니다</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Chatbot; 