import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MessageCircle } from 'lucide-react';
import ScheduleEditChatbot from './ScheduleEditChatbot';

const CalendarView = ({ schedule, departmentStaffing, departments, onScheduleUpdate }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // 스케줄 시작일을 기준으로 현재 월 설정 (한국 시간대 기준)
    const parseYmdToLocal = (ymd) => {
      const [y, m, d] = (ymd || '').split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const startDate = parseYmdToLocal(schedule.week_start_date);
    return new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1, 9, 0, 0));
  });
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [localSchedule, setLocalSchedule] = useState(schedule);

  // 스케줄이 변경될 때 로컬 상태 업데이트
  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  // 챗봇에서 스케줄 수정 시 로컬 상태 즉시 업데이트
  const handleScheduleUpdate = (updatedSchedule) => {
    setLocalSchedule(prev => ({
      ...prev,
      schedule_data: updatedSchedule
    }));
    
    // 부모 컴포넌트에도 전달
    if (onScheduleUpdate) {
      onScheduleUpdate(updatedSchedule);
    }
  };

  // 현재 월의 날짜들을 생성 (한국 시간대 기준)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 한국 시간대 기준으로 날짜 생성
    const firstDay = new Date(Date.UTC(year, month, 1, 9, 0, 0)); // UTC+9 (한국 시간)
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 9, 0, 0));
    
    // 첫 번째 날의 요일 (0: 일요일, 1: 월요일, ...)
    const firstDayOfWeek = firstDay.getUTCDay();
    
    // 한국식 요일 순서로 변환 (월요일을 0으로)
    // JavaScript: 0(일), 1(월), 2(화), 3(수), 4(목), 5(금), 6(토)
    // 한국식: 0(월), 1(화), 2(수), 3(목), 4(금), 5(토), 6(일)
    let koreanFirstDayOfWeek = firstDayOfWeek - 1;
    if (koreanFirstDayOfWeek < 0) koreanFirstDayOfWeek = 6; // 일요일인 경우 6으로 변환
    
    // 이전 달의 마지막 날들
    const prevMonthDays = [];
    const prevMonth = new Date(Date.UTC(year, month - 1, 0, 9, 0, 0));
    for (let i = koreanFirstDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push(new Date(Date.UTC(year, month - 1, prevMonth.getUTCDate() - i, 9, 0, 0)));
    }
    
    // 현재 달의 날짜들
    const currentMonthDays = [];
    for (let day = 1; day <= lastDay.getUTCDate(); day++) {
      currentMonthDays.push(new Date(Date.UTC(year, month, day, 9, 0, 0)));
    }
    
    // 다음 달의 첫 번째 날들 (캘린더를 6주로 맞추기 위해)
    const nextMonthDays = [];
    const totalDays = prevMonthDays.length + currentMonthDays.length;
    const weeksNeeded = Math.ceil(totalDays / 7);
    const totalCells = weeksNeeded * 7;
    const nextMonthDaysNeeded = totalCells - totalDays;
    
    for (let day = 1; day <= nextMonthDaysNeeded; day++) {
      nextMonthDays.push(new Date(Date.UTC(year, month + 1, day, 9, 0, 0)));
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [currentMonth]);

  // 파트 설정에서 work_hours가 있는 요일만 추출
  const workingDays = useMemo(() => {
    console.log('🔍 CalendarView - 근무 요일 분석:');
    console.log('- departments 타입:', typeof departments);
    console.log('- departments 배열 여부:', Array.isArray(departments));
    console.log('- departments 길이:', departments?.length || 0);
    
    // 목록 보기와 동일하게 월~금만 근무 요일로 설정
    const finalWorkingDays = ['월', '화', '수', '목', '금'];
    console.log('📅 캘린더에서 최종 표시할 근무 요일:', finalWorkingDays);
    console.log('- 목록 보기와 동일하게 월~금으로 고정 설정');
    
    return finalWorkingDays;
  }, [departments, departmentStaffing]);

  // 스케줄 데이터를 날짜별로 정리
  const scheduleByDate = useMemo(() => {
    const scheduleMap = {};
    
    if (localSchedule.schedule_data) {
      // 스케줄 시작일과 종료일
      const parseYmdToLocal = (ymd) => {
        const [y, m, d] = (ymd || '').split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      };
      const formatDateLocal = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const startDate = parseYmdToLocal(localSchedule.week_start_date);
      const endDate = parseYmdToLocal(localSchedule.week_end_date);
      
      // 전체 기간의 모든 날짜에 대해 스케줄 생성 (한국 시간대 기준)
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        // 날짜 키 생성 (YYYY-MM-DD 형식)
        const dateKey = formatDateLocal(currentDate);
        
        // 해당 날짜의 요일 계산 (한국 시간대 기준)
        const dayOfWeek = currentDate.getDay(); // 0: 일요일, 1: 월요일, ...
        
        // 한국 요일 배열 (일요일부터 시작 - JavaScript getDay()와 일치)
        // JavaScript getDay(): 0(일), 1(월), 2(화), 3(수), 4(목), 5(금), 6(토)
        // 한국 요일: 일(0), 월(1), 화(2), 수(3), 목(4), 금(5), 토(6)
        const koreanDays = ['일', '월', '화', '수', '목', '금', '토'];
        const koreanDay = koreanDays[dayOfWeek];
        
        // 디버깅: 날짜-요일 매핑 확인
        console.log(`🔍 날짜-요일 매핑: ${dateKey} → ${koreanDay}요일 (dayOfWeek: ${dayOfWeek})`);
        
        // 특정 날짜 검증 (2025년 8월 18일, 19일)
        if (dateKey === '2025-08-18') {
          console.log(`🔍 8월18일 특별 검증:`, {
            dateKey,
            dayOfWeek,
            koreanDay,
            expectedDay: '월',
            isCorrect: koreanDay === '월'
          });
        }
        if (dateKey === '2025-08-19') {
          console.log(`🔍 8월19일 특별 검증:`, {
            dateKey,
            dayOfWeek,
            koreanDay,
            expectedDay: '화',
            isCorrect: koreanDay === '화'
          });
        }
        
        // 해당 요일의 스케줄 데이터 가져오기 (파트 설정과 관계없이)
        const daySchedules = localSchedule.schedule_data[koreanDay];
        
        console.log(`🔍 ${dateKey} (${koreanDay}요일) 스케줄 분석:`, {
          요일: koreanDay,
          스케줄데이터: daySchedules,
          배열여부: Array.isArray(daySchedules),
          길이: Array.isArray(daySchedules) ? daySchedules.length : 'N/A'
        });
        
        if (daySchedules && Array.isArray(daySchedules) && daySchedules.length > 0) {
          // 스케줄 데이터가 있으면 표시
          scheduleMap[dateKey] = daySchedules.map(dept => ({
            ...dept,
            actual_date: dateKey, // 실제 날짜 추가
            day_of_week: koreanDay // 요일 정보 추가
          }));
          console.log(`✅ ${dateKey} 스케줄 추가됨:`, scheduleMap[dateKey].length, '개');
        } else {
          // 스케줄이 없는 날은 빈 배열로 표시
          scheduleMap[dateKey] = [];
          console.log(`❌ ${dateKey} 스케줄 없음`);
        }
        
        // 다음 날로 이동 (한국 시간대 기준, 하루씩 밀림 방지)
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log('📊 스케줄 날짜별 매핑 최종 결과:', {
        startDate: schedule.week_start_date,
        endDate: schedule.week_end_date,
        totalDays: Object.keys(scheduleMap).length,
        workingDays: workingDays,
        scheduleMap: scheduleMap,
        schedule_data_keys: Object.keys(schedule.schedule_data || {}),
        sampleMapping: Object.entries(scheduleMap).slice(0, 5), // 처음 5일만 샘플로 표시
        // 요일 매핑 디버깅
        dayMapping: {
          '월': schedule.schedule_data['월'] || '없음',
          '화': schedule.schedule_data['화'] || '없음',
          '수': schedule.schedule_data['수'] || '없음',
          '목': schedule.schedule_data['목'] || '없음',
          '금': schedule.schedule_data['금'] || '없음',
          '토': schedule.schedule_data['토'] || '없음',
          '일': schedule.schedule_data['일'] || '없음'
        },
        // 스케줄 다양성 검증
        scheduleVariety: (() => {
          const patterns = new Set();
          Object.values(scheduleMap).forEach(daySchedule => {
            const pattern = JSON.stringify(daySchedule.map(dept => ({
              department: dept.department_name,
              required: dept.required_staff_count,
              assigned: dept.assigned_employees?.length || dept.employees?.length || dept.worker_assignments?.length || 0
            })));
            patterns.add(pattern);
          });
          
          return {
            totalDays: Object.keys(scheduleMap).length,
            uniquePatterns: patterns.size,
            isRepeating: patterns.size < Object.keys(scheduleMap).length,
            varietyPercentage: Math.round((patterns.size / Object.keys(scheduleMap).length) * 100)
          };
        })()
      });
    }
    
    return scheduleMap;
  }, [schedule, workingDays]);

  // 이전 달로 이동 (한국 시간대 기준)
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(Date.UTC(prev.getFullYear(), prev.getMonth() - 1, 1, 9, 0, 0)));
  };

  // 다음 달로 이동 (한국 시간대 기준)
  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(Date.UTC(prev.getFullYear(), prev.getMonth() + 1, 1, 9, 0, 0)));
  };

  // 오늘 날짜인지 확인 (한국 시간대 기준)
  const isToday = (date) => {
    const today = new Date();
    const koreanToday = new Date(today.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    
    return koreanDate.toDateString() === koreanToday.toDateString();
  };

  // 스케줄이 있는 날짜인지 확인
  const hasSchedule = (date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return scheduleByDate[dateKey] && scheduleByDate[dateKey].length > 0;
  };

  // 날짜가 스케줄 기간 내에 있는지 확인
  const isInSchedulePeriod = (date) => {
    const parseYmdToLocal = (ymd) => {
      const [y, m, d] = (ymd || '').split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const startDate = parseYmdToLocal(schedule.week_start_date);
    const endDate = parseYmdToLocal(schedule.week_end_date);
    return date >= startDate && date <= endDate;
  };

  // 요일 헤더 (월요일부터 시작)
  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </h3>
        </div>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* 스케줄 기간 정보 */}
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <div className="text-sm text-blue-800">
          <strong>스케줄 기간:</strong> {schedule.week_start_date} ~ {schedule.week_end_date}
          <span className="ml-2 text-blue-600">
            (총 {(() => {
              const start = new Date(schedule.week_start_date);
              const end = new Date(schedule.week_end_date);
              const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
              return `${days}일`;
            })()})
          </span>
        </div>
        <div className="text-xs text-blue-600 mt-1">
          스케줄 데이터 구조: {Object.keys(schedule.schedule_data || {}).join(', ')}
        </div>
        {/* 스케줄 다양성 지표 */}
        {(() => {
          const patterns = new Set();
          Object.values(scheduleByDate).forEach(daySchedule => {
            const pattern = JSON.stringify(daySchedule.map(dept => ({
              department: dept.department_name,
              required: dept.required_staff_count,
              assigned: dept.assigned_employees?.length || dept.employees?.length || dept.worker_assignments?.length || 0
            })));
            patterns.add(pattern);
          });
          
          const totalDays = Object.keys(scheduleByDate).length;
          const uniquePatterns = patterns.size;
          const varietyPercentage = Math.round((uniquePatterns / totalDays) * 100);
          const isRepeating = uniquePatterns < totalDays;
          
          return (
            <div className={`mt-2 p-2 rounded text-xs ${
              isRepeating ? 'bg-yellow-100 border border-yellow-300' : 'bg-green-100 border border-green-300'
            }`}>
              <div className={`font-medium ${
                isRepeating ? 'text-yellow-800' : 'text-green-800'
              }`}>
                📊 스케줄 다양성: {varietyPercentage}% ({uniquePatterns}/{totalDays}일)
              </div>
              <div className={`text-xs ${
                isRepeating ? 'text-yellow-700' : 'text-green-700'
              }`}>
                {isRepeating 
                  ? '⚠️ 일부 날짜에 동일한 패턴이 반복됩니다. 결근 정보를 확인해주세요.'
                  : '✅ 각 날짜별로 고유한 스케줄이 생성되었습니다.'
                }
              </div>
            </div>
          );
        })()}
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map(day => {
          const isWorkingDay = workingDays.includes(day);
          return (
            <div 
              key={day} 
              className={`p-3 text-center font-medium ${
                isWorkingDay 
                  ? 'text-gray-700 bg-gray-50' 
                  : 'text-gray-400 bg-gray-100'
              }`}
              title={isWorkingDay ? `${day}요일 근무` : `${day}요일 휴무`}
            >
              {day}
              {!isWorkingDay && <span className="text-xs block text-gray-400">휴무</span>}
            </div>
          );
        })}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const daySchedule = scheduleByDate[dateKey] || [];
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isTodayDate = isToday(date);
          const hasScheduleData = hasSchedule(date);
          const inSchedulePeriod = isInSchedulePeriod(date);

          return (
            <div
              key={index}
              className={`min-h-[120px] p-2 border-r border-b border-gray-200 ${
                !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
              } ${isTodayDate ? 'bg-blue-50 border-blue-300' : ''} ${
                inSchedulePeriod ? 'ring-1 ring-blue-200' : ''
              }`}
            >
              {/* 날짜 표시 */}
              <div className={`text-sm font-medium mb-2 ${
                isTodayDate ? 'text-blue-600' : 
                !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
              }`}>
                {date.getDate()}
                {isTodayDate && <span className="ml-1 text-xs">(오늘)</span>}
                {inSchedulePeriod && !isTodayDate && (
                  <span className="ml-1 text-xs text-green-600">(스케줄)</span>
                )}
              </div>

              {/* 스케줄 정보 */}
              {isCurrentMonth && inSchedulePeriod && daySchedule.length > 0 && (
                <div className="space-y-1">
                  {daySchedule.map((dept, deptIndex) => {
                    // 백엔드 응답 구조에 따라 assigned_employees 데이터 추출
                    let assignedEmployees = [];
                    if (dept.assigned_employees && Array.isArray(dept.assigned_employees)) {
                      assignedEmployees = dept.assigned_employees;
                    } else if (dept.employees && Array.isArray(dept.employees)) {
                      assignedEmployees = dept.employees;
                    } else if (dept.worker_assignments && Array.isArray(dept.worker_assignments)) {
                      assignedEmployees = dept.worker_assignments;
                    }

                    return (
                      <div key={deptIndex} className="bg-blue-100 p-2 rounded text-xs border border-blue-200">
                        <div className="font-medium text-blue-800 text-xs">
                          {dept.department_name}
                        </div>
                        <div className="text-blue-600 text-xs">
                          {assignedEmployees.length}명 배정
                        </div>
                        {assignedEmployees.length > 0 && (
                          <div className="text-blue-700 text-xs mt-1 pt-1 border-t border-blue-300">
                            {assignedEmployees.slice(0, 2).map((emp, empIndex) => (
                              <div key={empIndex}>
                                {emp.employee_name || emp.worker_name || emp.name || '직원'}
                              </div>
                            ))}
                            {assignedEmployees.length > 2 && (
                              <div className="text-blue-600 text-xs">
                                +{assignedEmployees.length - 2}명 더
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 스케줄 기간 내이지만 스케줄이 없는 경우 */}
              {isCurrentMonth && inSchedulePeriod && daySchedule.length === 0 && (
                <div className="text-xs text-gray-500 italic">
                  스케줄 없음
                </div>
              )}

              {/* 스케줄 기간 밖인 경우 */}
              {isCurrentMonth && !inSchedulePeriod && (
                <div className="text-xs text-gray-400 italic">
                  스케줄 기간 밖
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 캘린더 범례 */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
              <span>스케줄 있음</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded ring-1 ring-blue-200"></div>
              <span>오늘</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-white border border-gray-200 rounded ring-1 ring-blue-200"></div>
              <span>스케줄 기간</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
              <span>스케줄 없음</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
              <span>다른 달</span>
            </div>
            <div className="text-xs text-gray-500">
              총 {Object.keys(scheduleByDate).length}일의 스케줄
            </div>
          </div>
        </div>
        
        {/* AI 스케줄 수정 챗봇 토글 버튼 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>AI로 스케줄 수정하기</span>
          </button>
        </div>
      </div>

      {/* AI 스케줄 수정 챗봇 */}
      <ScheduleEditChatbot
        schedule={localSchedule}
        onScheduleUpdate={handleScheduleUpdate}
        isOpen={isChatbotOpen}
        onToggle={() => setIsChatbotOpen(false)}
      />
    </div>
  );
};

export default CalendarView;
