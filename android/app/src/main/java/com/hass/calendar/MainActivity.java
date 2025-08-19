package com.hass.calendar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 웹뷰 설정 최적화
        this.bridge.getWebView().getSettings().setDomStorageEnabled(true);
        this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
        this.bridge.getWebView().getSettings().setAllowFileAccess(true);
        this.bridge.getWebView().getSettings().setAllowContentAccess(true);
        
        // Google 로그인을 위한 추가 설정
        this.bridge.getWebView().getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // 세션 지속성 개선
        this.bridge.getWebView().getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        this.bridge.getWebView().getSettings().setDatabaseEnabled(true);
        
        // Firebase Auth 세션 지속성
        this.bridge.getWebView().getSettings().setSaveFormData(true);
        this.bridge.getWebView().getSettings().setSavePassword(true);
        
        // 추가 세션 설정 (API 레벨 33+ 호환)
        this.bridge.getWebView().getSettings().setAllowFileAccessFromFileURLs(true);
        this.bridge.getWebView().getSettings().setAllowUniversalAccessFromFileURLs(true);
        
        // 세션 쿠키 관리
        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this.bridge.getWebView(), true);
        
        // 추가 세션 설정
        this.bridge.getWebView().getSettings().setLoadWithOverviewMode(true);
        this.bridge.getWebView().getSettings().setUseWideViewPort(true);
        this.bridge.getWebView().getSettings().setBuiltInZoomControls(true);
        this.bridge.getWebView().getSettings().setDisplayZoomControls(false);
        
        // 세션 지속성 강화 (API 레벨 33+ 호환)
        this.bridge.getWebView().getSettings().setCacheMode(android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK);
        
        // 네트워크 연결 강화 설정
        this.bridge.getWebView().getSettings().setLoadsImagesAutomatically(true);
        this.bridge.getWebView().getSettings().setBlockNetworkImage(false);
        this.bridge.getWebView().getSettings().setBlockNetworkLoads(false);
        
                        // Google 로그인을 위한 추가 설정
                this.bridge.getWebView().getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
                this.bridge.getWebView().getSettings().setSupportMultipleWindows(true);
                this.bridge.getWebView().getSettings().setSupportZoom(false);
                
                // COOP 오류 방지를 위한 추가 설정
                this.bridge.getWebView().getSettings().setDomStorageEnabled(true);
                this.bridge.getWebView().getSettings().setAllowFileAccess(true);
                this.bridge.getWebView().getSettings().setAllowContentAccess(true);
                this.bridge.getWebView().getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
}
