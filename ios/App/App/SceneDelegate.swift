import UIKit
import Capacitor
import WebKit

@available(iOS 13.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    var appleSignInPlugin: AppleSignInPlugin?
    private var pluginRegistered = false

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let viewController = storyboard.instantiateInitialViewController() {
            window.rootViewController = viewController
        }
        self.window = window
        window.makeKeyAndVisible()

        // WebView 로드 후 AppleSignInPlugin 등록 시도 (Scene 환경)
        appleSignInPlugin = AppleSignInPlugin()
        schedulePluginRegistrationRetries()
    }

    private func registerAppleSignInPlugin() {
        if pluginRegistered { return }
        guard let webView = findWebView() else {
            print("[SceneDelegate] WebView를 찾을 수 없습니다. AppleSignInPlugin 등록을 대기합니다.")
            return
        }

        print("[SceneDelegate] WebView 찾음. AppleSignInPlugin 등록 시도...")

        // AppleSignInPlugin에 WebView 참조 설정
        appleSignInPlugin?.setWebView(webView)

        // 기존 핸들러 제거 (중복 등록 방지)
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "AppleSignInPlugin")
        print("[SceneDelegate] 기존 핸들러 제거됨")

        let userContentController = webView.configuration.userContentController
        if let plugin = appleSignInPlugin {
            userContentController.add(plugin, name: "AppleSignInPlugin")
            print("[SceneDelegate] AppleSignInPlugin 등록 완료.")
        }

        // JavaScript에서 플러그인을 사용할 수 있도록 설정
        let script = """
        console.log('[SceneDelegate] JavaScript 플러그인 등록 시작...');

        if (window.Capacitor && window.Capacitor.Plugins) {
            (function registerAppleSignInBridge(){
              const makeBridge = function() {
                return {
                  signIn: function() {
                    return new Promise((resolve, reject) => {
                      console.log('[JavaScript] AppleSignInPlugin.signIn() 호출됨 (Scene)');
                      window._appleSignInResolve = resolve;
                      window._appleSignInReject = reject;
                      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.AppleSignInPlugin) {
                        console.log('[JavaScript] 네이티브 핸들러로 메시지 전송 (Scene)');
                        window.webkit.messageHandlers.AppleSignInPlugin.postMessage({ action: 'signIn' });
                      } else {
                        console.error('[JavaScript] 네이티브 핸들러를 찾을 수 없음 (Scene)');
                        reject(new Error('네이티브 Apple Sign In 핸들러를 찾을 수 없습니다'));
                      }
                    });
                  }
                }
              };

              // 전역 독립 네임스페이스에도 바인딩 (Capacitor가 Plugins를 덮어써도 접근 가능)
              if (!window.AppleSignInPlugin) {
                window.AppleSignInPlugin = makeBridge();
              }

              // Capacitor Plugins에도 바인딩
              window.Capacitor.Plugins.AppleSignInPlugin = window.AppleSignInPlugin;

              // 주기적으로 재바인딩하여 덮어쓰기 대응
              if (!window.__appleSignInRebindInterval) {
                window.__appleSignInRebindInterval = setInterval(() => {
                  try {
                    if (window.Capacitor && window.Capacitor.Plugins) {
                      window.Capacitor.Plugins.AppleSignInPlugin = window.AppleSignInPlugin;
                    }
                  } catch (_) {}
                }, 1000);
              }

              console.log('[SceneDelegate] AppleSignInPlugin JavaScript 등록/재바인딩 설정 완료');
            })();
        } else {
            console.error('[SceneDelegate] window.Capacitor.Plugins를 찾을 수 없음');
        }
        """

        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("[SceneDelegate] JavaScript 플러그인 등록 실패:", error)
            } else {
                print("[SceneDelegate] JavaScript 플러그인 등록 성공")
                self.pluginRegistered = true
            }
        }
    }

    private func schedulePluginRegistrationRetries() {
        // 즉시 + 0.5s 간격으로 최대 10회 재시도
        let maxAttempts = 10
        let interval: TimeInterval = 0.5
        for i in 0..<maxAttempts {
            DispatchQueue.main.asyncAfter(deadline: .now() + (interval * Double(i))) { [weak self] in
                guard let self = self else { return }
                if let _ = self.findWebView() {
                    self.registerAppleSignInPlugin()
                } else if i == maxAttempts - 1 {
                    print("[SceneDelegate] WebView 탐색 최대 재시도 초과")
                }
            }
        }
    }

    private func findWebView() -> WKWebView? {
        if let rootVC = window?.rootViewController {
            if let bridgeVC = rootVC as? CAPBridgeViewController {
                if let webView = bridgeVC.webView { return webView }
                for subview in bridgeVC.view.subviews {
                    if let webView = subview as? WKWebView { return webView }
                    if let scroll = subview as? UIScrollView {
                        for subSubview in scroll.subviews {
                            if let webView = subSubview as? WKWebView { return webView }
                        }
                    }
                }
            } else {
                for subview in rootVC.view.subviews {
                    if let webView = subview as? WKWebView { return webView }
                }
            }
        }
        return nil
    }
}


