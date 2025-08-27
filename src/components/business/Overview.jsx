/**
 * 개요 컴포넌트
 * 업체 대시보드의 메인 개요 페이지
 */

import React, { memo } from 'react';
import { Calendar, Briefcase, Users } from 'lucide-react';

const Overview = memo(({ currentUser, departments, onNavigate }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div 
        className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => onNavigate(`/calendar/${currentUser.uid}`)}
      >
        <div className="flex items-center">
          <Calendar className="h-8 w-8 text-green-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">캘린더</p>
            <p className="text-2xl font-bold text-gray-900">보기</p>
            <p className="text-xs text-green-600 mt-1">예약 현황 →</p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => onNavigate('schedule')}
      >
        <div className="flex items-center">
          <Calendar className="h-8 w-8 text-blue-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">스케줄 관리</p>
            <p className="text-2xl font-bold text-gray-900">설정</p>
            <p className="text-xs text-blue-600 mt-1">스케줄 관리 →</p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => onNavigate('categories')}
      >
        <div className="flex items-center">
          <Briefcase className="h-8 w-8 text-purple-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">파트 관리</p>
            <p className="text-2xl font-bold text-gray-900">{departments.length}개</p>
            <p className="text-xs text-purple-600 mt-1">파트 관리 →</p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => onNavigate('workers')}
      >
        <div className="flex items-center">
          <Users className="h-8 w-8 text-orange-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">피고용자</p>
            <p className="text-2xl font-bold text-gray-900">관리</p>
            <p className="text-xs text-orange-600 mt-1">노동자 관리 →</p>
          </div>
        </div>
      </div>
    </div>
  );
});

Overview.displayName = 'Overview';

export default Overview;
