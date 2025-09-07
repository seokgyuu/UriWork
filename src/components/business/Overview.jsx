/**
 * 개요 컴포넌트
 * 업체 대시보드의 메인 개요 페이지
 */

import React, { memo } from 'react';
import { Calendar, Briefcase, Users } from 'lucide-react';

const Overview = memo(({ currentUser, departments, onNavigate }) => {
  return (
    <div className="full-width-content full-width-grid">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full">
        <div 
          className="bg-white p-4 sm:p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 card-padding-responsive"
          onClick={() => onNavigate(`/calendar/${currentUser.uid}`)}
        >
          <div className="flex items-center">
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 text-responsive-sm">캘린더</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 text-responsive-xl">보기</p>
              <p className="text-xs text-green-600 mt-1 text-responsive-xs">예약 현황 →</p>
            </div>
          </div>
        </div>
      
        <div 
          className="bg-white p-4 sm:p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 card-padding-responsive"
          onClick={() => onNavigate('schedule')}
        >
          <div className="flex items-center">
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 text-responsive-sm">스케줄 관리</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 text-responsive-xl">설정</p>
              <p className="text-xs text-blue-600 mt-1 text-responsive-xs">스케줄 관리 →</p>
            </div>
          </div>
        </div>
      
        <div 
          className="bg-white p-4 sm:p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 card-padding-responsive"
          onClick={() => onNavigate('categories')}
        >
          <div className="flex items-center">
            <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 text-responsive-sm">파트 관리</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 text-responsive-xl">{departments.length}개</p>
              <p className="text-xs text-purple-600 mt-1 text-responsive-xs">파트 관리 →</p>
            </div>
          </div>
        </div>
      
        <div 
          className="bg-white p-4 sm:p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 card-padding-responsive"
          onClick={() => onNavigate('workers')}
        >
          <div className="flex items-center">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 text-responsive-sm">직원</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 text-responsive-xl">관리</p>
              <p className="text-xs text-orange-600 mt-1 text-responsive-xs">직원 관리 →</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Overview.displayName = 'Overview';

export default Overview;
