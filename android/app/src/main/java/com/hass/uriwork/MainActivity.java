package com.hass.uriwork;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private static final int RC_SIGN_IN = 9001;
    private GoogleSignInClient mGoogleSignInClient;
    private FirebaseAuth mAuth;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Firebase Auth 초기화
        mAuth = FirebaseAuth.getInstance();
        
        // Google Sign-In 옵션 구성
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken("1014872932714-t5qnkoa0dthrn8gobou9534bq77dii4i.apps.googleusercontent.com")
                .requestEmail()
                .build();
        
        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
        
        // WebView에 JavaScript 인터페이스 추가
        bridge.getWebView().addJavascriptInterface(new GoogleSignInInterface(), "GoogleSignInPlugin");
        
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
    
    // Google Sign-In 결과 처리
    @Override
    public void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == RC_SIGN_IN) {
            Task<com.google.android.gms.auth.api.signin.GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                com.google.android.gms.auth.api.signin.GoogleSignInAccount account = task.getResult(ApiException.class);
                firebaseAuthWithGoogle(account.getIdToken());
            } catch (ApiException e) {
                Log.w("GoogleSignIn", "Google sign in failed", e);
                // JavaScript로 에러 전달
                bridge.getWebView().evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('googleSignInError', {detail: {message: 'Google 로그인에 실패했습니다.'}}));", 
                    null
                );
            }
        }
    }
    
    // Firebase Auth로 Google 로그인 처리
    private void firebaseAuthWithGoogle(String idToken) {
        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        mAuth.signInWithCredential(credential)
            .addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) {
                    com.google.firebase.auth.FirebaseUser user = mAuth.getCurrentUser();
                    Log.d("GoogleSignIn", "signInWithCredential:success");
                    
                    // JavaScript로 성공 결과 전달
                    String userData = String.format(
                        "{'uid': '%s', 'email': '%s', 'displayName': '%s', 'photoURL': '%s'}",
                        user.getUid(),
                        user.getEmail() != null ? user.getEmail() : "",
                        user.getDisplayName() != null ? user.getDisplayName() : "",
                        user.getPhotoUrl() != null ? user.getPhotoUrl().toString() : ""
                    );
                    
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('googleSignInSuccess', {detail: {user: " + userData + "}}));", 
                        null
                    );
                } else {
                    Log.w("GoogleSignIn", "signInWithCredential:failure", task.getException());
                    // JavaScript로 에러 전달
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('googleSignInError', {detail: {message: 'Firebase 인증에 실패했습니다.'}}));", 
                        null
                    );
                }
            });
    }
    
    // JavaScript 인터페이스 클래스
    public class GoogleSignInInterface {
        @JavascriptInterface
        public void googleSignIn() {
            runOnUiThread(() -> {
                android.content.Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                startActivityForResult(signInIntent, RC_SIGN_IN);
            });
        }
    }
}
