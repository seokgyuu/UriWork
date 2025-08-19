/**
 * 구독 컴포넌트
 * 업체가 서비스 구독 플랜을 선택하고 결제할 수 있는 페이지
 * Basic, Premium, Enterprise 등 다양한 플랜 제공
 * 구독 혜택, 가격, 결제 방법 등을 안내
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionAPI } from '../../services/api';
import { 
  ChevronLeft, 
  CreditCard,
  Check,
  Star,
  Crown,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const Subscription = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const plans = [
    {
      id: 'basic',
      name: '기본 플랜',
      price: '29,000원',
      period: '월',
      icon: CreditCard,
      color: 'bg-blue-500',
      features: [
        '기본 캘린더 관리',
        '최대 5명 노동자',
        '기본 예약 시스템',
        '이메일 지원'
      ],
      popular: false
    },
    {
      id: 'premium',
      name: '프리미엄 플랜',
      price: '59,000원',
      period: '월',
      icon: Star,
      color: 'bg-purple-500',
      features: [
        '모든 기본 기능',
        '최대 20명 노동자',
        '고급 예약 시스템',
        '챗봇 지원',
        '우선 고객 지원',
        '데이터 분석'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: '엔터프라이즈 플랜',
      price: '99,000원',
      period: '월',
      icon: Crown,
      color: 'bg-yellow-500',
      features: [
        '모든 프리미엄 기능',
        '무제한 노동자',
        '맞춤형 통합',
        '전담 매니저',
        '24/7 지원',
        '고급 보안'
      ],
      popular: false
    }
  ];

  const handleSubscribe = async (planId) => {
    setLoading(true);
    try {
      const subscriptionData = {
        business_id: currentUser.uid,
        plan_type: planId
      };

      await subscriptionAPI.create(subscriptionData);
      toast.success('구독이 성공적으로 생성되었습니다!');
      navigate('/business');
    } catch (error) {
      toast.error('구독 생성 중 오류가 발생했습니다.');
      console.error('구독 생성 에러:', error);
    } finally {
      setLoading(false);
    }
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
                구독 관리
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 현재 구독 정보 */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            현재 구독 상태
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Zap className="h-6 w-6 text-yellow-500 mr-2" />
              <span className="text-lg font-medium text-gray-900">
                무료 체험판
              </span>
            </div>
            <span className="text-sm text-gray-600">
              기본 기능만 사용 가능
            </span>
          </div>
        </div>

        {/* 구독 플랜 */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-lg shadow-lg overflow-hidden ${
                plan.popular ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-center py-2 text-sm font-medium">
                  인기 플랜
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-md ${plan.color}`}>
                    <plan.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      <span className="text-gray-600 ml-1">
                        /{plan.period}
                      </span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                    plan.popular
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {loading ? '처리 중...' : '구독 시작'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 구독 안내 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            구독 안내
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 모든 플랜은 30일 무료 체험을 제공합니다</li>
            <li>• 언제든지 구독을 취소할 수 있습니다</li>
            <li>• 구독 변경은 언제든지 가능합니다</li>
            <li>• 기술 지원은 모든 플랜에서 제공됩니다</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Subscription; 