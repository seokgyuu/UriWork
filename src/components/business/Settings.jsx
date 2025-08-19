/**
 * 설정 컴포넌트
 * 업체 정보 및 시스템 설정
 */

import React, { memo } from 'react';

const Settings = memo(() => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">설정</h3>
      <p className="text-sm text-gray-600">업체 정보 및 시스템 설정</p>
      
      <div className="mt-6 space-y-4">
        <div className="border-t pt-4">
          <h4 className="text-md font-medium text-gray-800 mb-2">업체 정보</h4>
          <p className="text-sm text-gray-600">업체 정보를 관리하고 수정할 수 있습니다.</p>
        </div>
        
        <div className="border-t pt-4">
          <h4 className="text-md font-medium text-gray-800 mb-2">시스템 설정</h4>
          <p className="text-sm text-gray-600">알림, 언어, 테마 등의 시스템 설정을 관리합니다.</p>
        </div>
        
        <div className="border-t pt-4">
          <h4 className="text-md font-medium text-gray-800 mb-2">보안 설정</h4>
          <p className="text-sm text-gray-600">비밀번호 변경, 2단계 인증 등의 보안 설정을 관리합니다.</p>
        </div>
      </div>
    </div>
  );
});

Settings.displayName = 'Settings';

export default Settings;
