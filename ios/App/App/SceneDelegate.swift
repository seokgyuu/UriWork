import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate, WKScriptMessageHandler {

	var window: UIWindow?

	func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Use this method to optionally configure and attach the UIWindow `window` to the provided UIWindowScene `scene`.
        // If using a storyboard, the `window` property will automatically be set and attached to the scene.
        // This delegate does not imply the connecting scene or session are new (see `application:configurationForConnectingSceneSession` instead).
		guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // window 설정
		if self.window == nil {
			let window = UIWindow(windowScene: windowScene)
			// Main.storyboard의 초기 ViewController 사용
			window.rootViewController = UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController()
			self.window = window
			window.makeKeyAndVisible()
		}
        
        print("[SceneDelegate] Scene 연결됨, AppleSignInPlugin 등록 준비...")
        print("[SceneDelegate] window 설정됨: \(String(describing: self.window))")
        print("[SceneDelegate] rootViewController: \(String(describing: self.window?.rootViewController))")
        
        // WebView 로드 후 AppleSignInPlugin 등록 - 여러 번 시도
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("[SceneDelegate] 1차 AppleSignInPlugin 등록 시도...")
            self.registerAppleSignInPlugin()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            print("[SceneDelegate] 2차 AppleSignInPlugin 등록 시도...")
            self.registerAppleSignInPlugin()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            print("[SceneDelegate] 3차 AppleSignInPlugin 등록 시도...")
            self.registerAppleSignInPlugin()
        }
    }
    
    private func registerAppleSignInPlugin() {
        print("[SceneDelegate] AppleSignInPlugin 등록 시작...")
        
        // WebView를 찾는 방법
        if let webView = findWebView() {
            print("[SceneDelegate] WebView 찾음, AppleSignInPlugin 등록 중...")
            
            // 기존 핸들러 제거 (중복 등록 방지)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "AppleSignInPlugin")
            print("[SceneDelegate] 기존 핸들러 제거됨")
            
            // AppleSignInPlugin을 WebView에 등록
            webView.configuration.userContentController.add(self, name: "AppleSignInPlugin")
            print("[SceneDelegate] AppleSignInPlugin 핸들러 등록됨")
            
            // JavaScript에서 플러그인을 사용할 수 있도록 설정
            let script = """
            console.log('[SceneDelegate] JavaScript 플러그인 등록 시작...');
            
            // 기존 플러그인이 있으면 제거
            if (window.Capacitor && window.Capacitor.Plugins) {
                if (window.Capacitor.Plugins.AppleSignInPlugin) {
                    delete window.Capacitor.Plugins.AppleSignInPlugin;
                    console.log('[SceneDelegate] 기존 AppleSignInPlugin 제거됨');
                }
                
                // AppleSignInPlugin 등록
                window.Capacitor.Plugins.AppleSignInPlugin = {
                    signIn: function() {
                        return new Promise((resolve, reject) => {
                            console.log('[JavaScript] AppleSignInPlugin.signIn() 호출됨');
                            
                            // Promise를 전역에 저장하여 나중에 호출할 수 있도록 함
                            window._appleSignInResolve = resolve;
                            window._appleSignInReject = reject;
                            
                            // 네이티브 플러그인 호출을 위한 브릿지
                            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.AppleSignInPlugin) {
                                console.log('[JavaScript] 네이티브 핸들러로 메시지 전송');
                                window.webkit.messageHandlers.AppleSignInPlugin.postMessage({
                                    action: 'signIn'
                                });
                            } else {
                                console.error('[JavaScript] 네이티브 핸들러를 찾을 수 없음');
                                reject(new Error('네이티브 Apple Sign In 핸들러를 찾을 수 없습니다'));
                            }
                        });
                    }
                };
                
                console.log('[SceneDelegate] AppleSignInPlugin JavaScript 등록 완료');
                console.log('[SceneDelegate] AppleSignInPlugin 상태:', !!window.Capacitor.Plugins.AppleSignInPlugin);
                console.log('[SceneDelegate] window.webkit.messageHandlers.AppleSignInPlugin:', !!window.webkit.messageHandlers.AppleSignInPlugin);
            } else {
                console.error('[SceneDelegate] window.Capacitor.Plugins를 찾을 수 없음');
            }
            """
            
            // addUserScript 대신 evaluateJavaScript 사용
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("[SceneDelegate] JavaScript 플러그인 등록 실패:", error)
                } else {
                    print("[SceneDelegate] JavaScript 플러그인 등록 성공")
                }
            }
            
            print("[SceneDelegate] JavaScript 스크립트 등록 완료")
        } else {
            print("[SceneDelegate] WebView를 찾을 수 없음, 재시도 예정...")
            // 재시도
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.registerAppleSignInPlugin()
            }
        }
    }
    
    private func findWebView() -> WKWebView? {
        print("[SceneDelegate] WebView 검색 시작...")
        
        guard let window = self.window else {
            print("[SceneDelegate] window가 nil입니다")
            return nil
        }
        
        guard let rootVC = window.rootViewController else {
            print("[SceneDelegate] rootViewController가 nil입니다")
            return nil
        }
        
        print("[SceneDelegate] Root ViewController: \(type(of: rootVC))")
        
        // CAPBridgeViewController 확인
        if let bridgeVC = rootVC as? CAPBridgeViewController {
            print("[SceneDelegate] CAPBridgeViewController 발견!")
            
            // CAPBridgeViewController의 webView 속성 직접 사용
            if let webView = bridgeVC.webView {
                print("[SceneDelegate] CAPBridgeViewController.webView에서 직접 찾음!")
                return webView
            }
            
            // webView가 nil인 경우 하위 뷰에서 검색
            print("[SceneDelegate] CAPBridgeViewController.webView가 nil, 하위 뷰에서 검색...")
            
            for (index, subview) in bridgeVC.view.subviews.enumerated() {
                print("[SceneDelegate] 하위 뷰 \(index): \(type(of: subview))")
                
                if let webView = subview as? WKWebView {
                    print("[SceneDelegate] 직접 WKWebView 찾음")
                    return webView
                }
                
                // UIScrollView에서 WKWebView 찾기
                if let scrollView = subview as? UIScrollView {
                    print("[SceneDelegate] UIScrollView 발견")
                    
                    // UIScrollView의 superview가 WKWebView인지 확인
                    if let webView = scrollView.superview as? WKWebView {
                        print("[SceneDelegate] UIScrollView의 superview에서 WKWebView 찾음")
                        return webView
                    }
                    
                    // UIScrollView의 하위 뷰에서 WKWebView 찾기
                    for (subIndex, subSubview) in scrollView.subviews.enumerated() {
                        print("[SceneDelegate] UIScrollView 하위 뷰 \(subIndex): \(type(of: subSubview))")
                        if let webView = subSubview as? WKWebView {
                            print("[SceneDelegate] UIScrollView 하위에서 WKWebView 찾음")
                            return webView
                        }
                    }
                }
                
                // 더 깊은 레벨에서 검색
                for (subIndex, subSubview) in subview.subviews.enumerated() {
                    print("[SceneDelegate] 하위 뷰 \(index)-\(subIndex): \(type(of: subSubview))")
                    
                    if let webView = subSubview as? WKWebView {
                        print("[SceneDelegate] 깊은 레벨에서 WKWebView 찾음")
                        return webView
                    }
                    
                    // UIView에서 WKWebView 찾기
                    if let contentView = subSubview as? UIView {
                        print("[SceneDelegate] UIView 발견, WKWebView 검색 중...")
                        
                        // UIView의 superview가 WKWebView인지 확인
                        if let webView = contentView.superview as? WKWebView {
                            print("[SceneDelegate] UIView의 superview에서 WKWebView 찾음")
                            return webView
                        }
                        
                        // UIView의 하위 뷰에서 WKWebView 찾기
                        for (deepIndex, deepSubview) in contentView.subviews.enumerated() {
                            print("[SceneDelegate] UIView 하위 뷰 \(deepIndex): \(type(of: deepSubview))")
                            if let webView = deepSubview as? WKWebView {
                                print("[SceneDelegate] UIView 하위에서 WKWebView 찾음")
                                return webView
                            }
                        }
                    }
                }
            }
        } else {
            print("[SceneDelegate] CAPBridgeViewController가 아닙니다: \(type(of: rootVC))")
            
            // 일반 ViewController에서도 검색
            print("[SceneDelegate] 일반 ViewController에서 WebView 검색...")
            
            for subview in rootVC.view.subviews {
                if let webView = subview as? WKWebView {
                    print("[SceneDelegate] 일반 ViewController에서 WKWebView 찾음")
                    return webView
                }
            }
        }
        
        print("[SceneDelegate] WebView를 찾을 수 없음")
        return nil
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("[SceneDelegate] WKScriptMessageHandler 메시지 수신: name=\(message.name), body=\(message.body)")
        
        // AppDelegate로 메시지 전달
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
            appDelegate.userContentController(userContentController, didReceive: message)
        } else {
            print("[SceneDelegate] AppDelegate를 찾을 수 없음")
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        // Called as the scene is being released by the system.
        // This occurs shortly after the scene enters the background, or when its session is discarded.
        // Release any resources associated with this scene that can be re-created the next time the scene connects.
        // The scene may re-connect later, as its session was not necessarily discarded (see `application:didDiscardSceneSessions` instead).
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Called when the scene has moved from an inactive state to an active state.
        // Use this method to restart any tasks that were paused (or not yet started) when the scene was inactive.
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state.
        // This may occur due to temporary interruptions (ex: an incoming phone call).
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground.
        // Use this method to undo the changes made on entering the background.
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background.
        // Use this method to save data, release shared resources, and store enough scene-specific state information
        // to restore the scene back to its current state.

        // Save changes in the application's managed object context when the application transitions to the background.
        (UIApplication.shared.delegate as? AppDelegate)?.saveContext()
    }
}


