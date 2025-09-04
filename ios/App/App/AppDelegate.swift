import UIKit
import CoreData
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import Capacitor
import AuthenticationServices
import WebKit
import GoogleSignIn

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var appleSignInPlugin: AppleSignInPlugin?
    var googleSignInPlugin: GoogleSignInPlugin?
            
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Firebase 초기화
        FirebaseApp.configure()
        
        // Google Sign-In 초기화
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let plist = NSDictionary(contentsOfFile: path),
           let clientId = plist["CLIENT_ID"] as? String {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
            print("[AppDelegate] Google Sign-In 초기화 완료: \(clientId)")
        } else {
            print("[AppDelegate] GoogleService-Info.plist에서 CLIENT_ID를 찾을 수 없습니다.")
        }
        
        // Bundle ID 확인
        if let bundleID = Bundle.main.bundleIdentifier {
            print("[AppDelegate] Bundle ID: \(bundleID)")
        }
        
        // Firebase 옵션 확인
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let options = FirebaseOptions(contentsOfFile: path) {
            print("[Firebase] options.bundleID=\(options.bundleID)")
            print("[Firebase] options.googleAppID=\(options.googleAppID)")
            print("[Firebase] options.clientID=\(options.clientID)")
            print("[Firebase] options.projectID=\(options.projectID)")
            print("[Firebase] GoogleService-Info.plist path: \(path)")
        }
        
        // Window 설정 (iOS 12 이하는 AppDelegate에서 처리, iOS 13+는 SceneDelegate 처리)
        if #available(iOS 13.0, *) {
            // iOS 13+에서는 SceneDelegate가 윈도우를 관리합니다.
        } else {
            if window == nil {
                window = UIWindow(frame: UIScreen.main.bounds)
            }
            
            // Main.storyboard에서 초기 ViewController 설정
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            if let viewController = storyboard.instantiateInitialViewController() {
                window?.rootViewController = viewController
            }
            
            // Window를 keyAndVisible로 설정
            window?.makeKeyAndVisible()
        }
        
        // AppleSignInPlugin 초기화 (iOS 12 이하에서만 AppDelegate가 직접 등록)
        appleSignInPlugin = AppleSignInPlugin()
        
        // GoogleSignInPlugin 초기화
        googleSignInPlugin = GoogleSignInPlugin()

        if #available(iOS 13.0, *) {
            // iOS 13+에서는 SceneDelegate에서 등록을 처리하므로 여기서는 건너뜁니다.
        } else {
            // WebView 로드 후 플러그인 등록 - 즉시 시도
            DispatchQueue.main.async {
                print("[AppDelegate] 플러그인 즉시 등록 시도...")
                self.registerAppleSignInPlugin()
                self.registerGoogleSignInPlugin()
            }
            
            // 추가 등록 시도 (백업)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                print("[AppDelegate] 플러그인 백업 등록 시도...")
                self.registerAppleSignInPlugin()
                self.registerGoogleSignInPlugin()
            }
        }
        
        return true
    }

    // MARK: - UISceneSession Lifecycle
    @available(iOS 13.0, *)
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    @available(iOS 13.0, *)
    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // 리소스 정리 필요 시 처리
    }
    
    // MARK: - URL Scheme Handling
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        return GIDSignIn.sharedInstance.handle(url)
    }

    // MARK: - Core Data stack

    lazy var persistentContainer: NSPersistentContainer = {
        /*
         The persistent container for the application. This implementation
         creates and returns a container, having loaded the store for the
         application to it. This property is optional since there are legitimate
         error conditions that could cause the creation of the store to fail.
        */
        let container = NSPersistentContainer(name: "App")
        container.loadPersistentStores(completionHandler: { (storeDescription, error) in
            if let error = error as NSError? {
                // Replace this implementation with code to handle the error appropriately.
                // fatalError() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
                 
                /*
                 Typical reasons for an error here include:
                 * The parent directory does not exist, cannot be created, or disallows writing.
                 * The persistent store is not accessible, due to permissions or data protection when the device is locked.
                 * The device is out of space.
                 * The store could not be migrated to the current model version.
                 Check the error message to determine what the actual problem was.
                 */
                fatalError("Unresolved error \(error), \(error.userInfo)")
            }
        })
        return container
    }()

    // MARK: - Core Data Saving support

    func saveContext () {
        let context = persistentContainer.viewContext
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                // Replace this implementation with code to handle the error appropriately.
                // fatalError() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
                let nserror = error as NSError
                fatalError("Unresolved error \(nserror), \(nserror.userInfo)")
            }
        }
    }
    
    private func registerAppleSignInPlugin() {
        if let webView = findWebView() {
            print("[AppDelegate] WebView 찾음. AppleSignInPlugin 등록 시도...")
            
            // AppleSignInPlugin에 WebView 참조 설정
            appleSignInPlugin?.setWebView(webView)
            
            // 기존 핸들러 제거 (중복 등록 방지)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "AppleSignInPlugin")
            print("[AppDelegate] 기존 핸들러 제거됨")
            
            let userContentController = webView.configuration.userContentController
            userContentController.add(appleSignInPlugin!, name: "AppleSignInPlugin")
            print("[AppDelegate] AppleSignInPlugin 등록 완료.")
            
            // JavaScript에서 플러그인을 사용할 수 있도록 설정
            let script = """
            console.log('[AppDelegate] JavaScript 플러그인 등록 시작...');
            
            // 기존 플러그인이 있으면 제거
            if (window.Capacitor && window.Capacitor.Plugins) {
                if (window.Capacitor.Plugins.AppleSignInPlugin) {
                    delete window.Capacitor.Plugins.AppleSignInPlugin;
                    console.log('[AppDelegate] 기존 AppleSignInPlugin 제거됨');
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
                
                console.log('[AppDelegate] AppleSignInPlugin JavaScript 등록 완료');
                console.log('[AppDelegate] AppleSignInPlugin 상태:', !!window.Capacitor.Plugins.AppleSignInPlugin);
                console.log('[AppDelegate] window.webkit.messageHandlers.AppleSignInPlugin:', !!window.webkit.messageHandlers.AppleSignInPlugin);
                
                // 플러그인 등록 확인
                console.log('[AppDelegate] AppleSignInPlugin.signIn 함수:', typeof window.Capacitor.Plugins.AppleSignInPlugin.signIn);
                
                // 플러그인 등록 완료 확인
                console.log('[AppDelegate] AppleSignInPlugin 등록 완료 확인:', {
                    plugin: !!window.Capacitor.Plugins.AppleSignInPlugin,
                    signInFunction: typeof window.Capacitor.Plugins.AppleSignInPlugin.signIn,
                    messageHandler: !!window.webkit?.messageHandlers?.AppleSignInPlugin
                });
                
            } else {
                console.error('[AppDelegate] window.Capacitor.Plugins를 찾을 수 없음');
            }
            """
            
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("[AppDelegate] JavaScript 플러그인 등록 실패:", error)
                } else {
                    print("[AppDelegate] JavaScript 플러그인 등록 성공")
                }
            }
            
        } else {
            print("[AppDelegate] WebView를 찾을 수 없습니다. AppleSignInPlugin 등록을 대기합니다.")
        }
    }
    
    private func registerGoogleSignInPlugin() {
        if let webView = findWebView() {
            print("[AppDelegate] WebView 찾음. GoogleSignInPlugin 등록 시도...")
            
            // GoogleSignInPlugin에 WebView 참조 설정
            googleSignInPlugin?.setWebView(webView)
            
            // 기존 핸들러 제거 (중복 등록 방지)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "GoogleSignInPlugin")
            print("[AppDelegate] 기존 GoogleSignInPlugin 핸들러 제거됨")
            
            let userContentController = webView.configuration.userContentController
            userContentController.add(googleSignInPlugin!, name: "GoogleSignInPlugin")
            print("[AppDelegate] GoogleSignInPlugin 등록 완료.")
            
            // JavaScript에서 플러그인을 사용할 수 있도록 설정
            let script = """
            console.log('[AppDelegate] GoogleSignInPlugin JavaScript 등록 시작...');
            
            // 기존 플러그인이 있으면 제거
            if (window.Capacitor && window.Capacitor.Plugins) {
                if (window.Capacitor.Plugins.GoogleSignIn) {
                    delete window.Capacitor.Plugins.GoogleSignIn;
                    console.log('[AppDelegate] 기존 GoogleSignInPlugin 제거됨');
                }
                
                // GoogleSignInPlugin 등록
                window.Capacitor.Plugins.GoogleSignIn = {
                    signIn: function() {
                        return new Promise((resolve, reject) => {
                            console.log('[JavaScript] GoogleSignInPlugin.signIn() 호출됨');
                            
                            // Promise를 전역에 저장하여 나중에 호출할 수 있도록 함
                            window._googleSignInResolve = resolve;
                            window._googleSignInReject = reject;
                            
                            // 네이티브 플러그인 호출을 위한 브릿지
                            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.GoogleSignInPlugin) {
                                console.log('[JavaScript] 네이티브 핸들러로 메시지 전송');
                                window.webkit.messageHandlers.GoogleSignInPlugin.postMessage({
                                    action: 'signIn'
                                });
                            } else {
                                console.error('[JavaScript] 네이티브 핸들러를 찾을 수 없음');
                                reject(new Error('네이티브 Google Sign In 핸들러를 찾을 수 없습니다'));
                            }
                        });
                    }
                };
                
                console.log('[AppDelegate] GoogleSignInPlugin JavaScript 등록 완료');
                console.log('[AppDelegate] GoogleSignInPlugin 상태:', !!window.Capacitor.Plugins.GoogleSignIn);
                console.log('[AppDelegate] window.webkit.messageHandlers.GoogleSignInPlugin:', !!window.webkit.messageHandlers.GoogleSignInPlugin);
                
                // 플러그인 등록 확인
                console.log('[AppDelegate] GoogleSignInPlugin.signIn 함수:', typeof window.Capacitor.Plugins.GoogleSignIn.signIn);
                
                // 플러그인 등록 완료 확인
                console.log('[AppDelegate] GoogleSignInPlugin 등록 완료 확인:', {
                    plugin: !!window.Capacitor.Plugins.GoogleSignIn,
                    signInFunction: typeof window.Capacitor.Plugins.GoogleSignIn.signIn,
                    messageHandler: !!window.webkit?.messageHandlers?.GoogleSignInPlugin
                });
                
            } else {
                console.error('[AppDelegate] window.Capacitor.Plugins를 찾을 수 없음');
            }
            """
            
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("[AppDelegate] GoogleSignInPlugin JavaScript 등록 실패:", error)
                } else {
                    print("[AppDelegate] GoogleSignInPlugin JavaScript 등록 성공")
                }
            }
            
        } else {
            print("[AppDelegate] WebView를 찾을 수 없습니다. GoogleSignInPlugin 등록을 대기합니다.")
        }
    }
    
    private func findWebView() -> WKWebView? {
        print("[AppDelegate] WebView 검색 시작...")
        
        // 모든 윈도우에서 검색
        for window in UIApplication.shared.windows {
            print("[AppDelegate] 윈도우 검색 중: \(window)")
            
            if let rootVC = window.rootViewController {
                print("[AppDelegate] Root ViewController: \(type(of: rootVC))")
                
                // CAPBridgeViewController 확인
                if let bridgeVC = rootVC as? CAPBridgeViewController {
                    print("[AppDelegate] CAPBridgeViewController 발견!")
                    
                    // CAPBridgeViewController의 webView 속성 직접 사용
                    if let webView = bridgeVC.webView {
                        print("[AppDelegate] CAPBridgeViewController.webView에서 직접 찾음!")
                        return webView
                    }
                    
                    // webView가 nil인 경우 하위 뷰에서 검색
                    print("[AppDelegate] CAPBridgeViewController.webView가 nil, 하위 뷰에서 검색...")
                    
                    for (index, subview) in bridgeVC.view.subviews.enumerated() {
                        print("[AppDelegate] 하위 뷰 \(index): \(type(of: subview))")
                        
                        if let webView = subview as? WKWebView {
                            print("[AppDelegate] 직접 WKWebView 찾음")
                            return webView
                        }
                        
                        // UIScrollView에서 WKWebView 찾기
                        if let scrollView = subview as? UIScrollView {
                            print("[AppDelegate] UIScrollView 발견")
                            
                            // UIScrollView의 superview가 WKWebView인지 확인
                            if let webView = scrollView.superview as? WKWebView {
                                print("[AppDelegate] UIScrollView의 superview에서 WKWebView 찾음")
                                return webView
                            }
                            
                            // UIScrollView의 하위 뷰에서 WKWebView 찾기
                            for (subIndex, subSubview) in scrollView.subviews.enumerated() {
                                print("[AppDelegate] UIScrollView 하위 뷰 \(subIndex): \(type(of: subSubview))")
                                if let webView = subSubview as? WKWebView {
                                    print("[AppDelegate] UIScrollView 하위에서 WKWebView 찾음")
                                    return webView
                                }
                            }
                        }
                        
                        // 더 깊은 레벨에서 검색
                        for (subIndex, subSubview) in subview.subviews.enumerated() {
                            print("[AppDelegate] 하위 뷰 \(index)-\(subIndex): \(type(of: subSubview))")
                            
                            if let webView = subSubview as? WKWebView {
                                print("[AppDelegate] 깊은 레벨에서 WKWebView 찾음")
                                return webView
                            }
                            
                            // UIView에서 WKWebView 찾기
                            if subSubview is UIView {
                                print("[AppDelegate] UIView 발견, WKWebView 검색 중...")
                                
                                // UIView의 superview가 WKWebView인지 확인
                                if let webView = subSubview.superview as? WKWebView {
                                    print("[AppDelegate] UIView의 superview에서 WKWebView 찾음")
                                    return webView
                                }
                                
                                // UIView의 하위 뷰에서 WKWebView 찾기
                                for (deepIndex, deepSubview) in subSubview.subviews.enumerated() {
                                    print("[AppDelegate] UIView 하위 뷰 \(deepIndex): \(type(of: deepSubview))")
                                    if let webView = deepSubview as? WKWebView {
                                        print("[AppDelegate] UIView 하위에서 WKWebView 찾음")
                                        return webView
                                    }
                                }
                            }
                        }
                    }
                } else {
                    print("[AppDelegate] CAPBridgeViewController가 아닙니다: \(type(of: rootVC))")
                    
                    // 일반 ViewController에서도 검색
                    print("[AppDelegate] 일반 ViewController에서 WebView 검색...")
                    
                    for subview in rootVC.view.subviews {
                        if let webView = subview as? WKWebView {
                            print("[AppDelegate] 일반 ViewController에서 WKWebView 찾음")
                            return webView
                        }
                    }
                }
            }
        }
        
        print("[AppDelegate] WebView를 찾을 수 없음")
        return nil
    }
}

// MARK: - AppleSignInPlugin

class AppleSignInPlugin: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, WKScriptMessageHandler {
    
    private var completion: ((Result<AppleSignInResult, Error>) -> Void)?
    private var webView: WKWebView?
    private var isSigningIn = false // 중복 로그인 방지
    
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
        print("[AppleSignInPlugin] WebView 참조 저장됨")
    }
    
    func handleAppleSignIn(completion: @escaping (Result<AppleSignInResult, Error>) -> Void) {
        // 중복 로그인 방지
        if isSigningIn {
            print("[AppleSignInPlugin] 이미 Apple Sign In 진행 중입니다.")
            completion(.failure(NSError(domain: "AppleSignIn", code: -2, userInfo: [NSLocalizedDescriptionKey: "이미 Apple Sign In이 진행 중입니다."])))
            return
        }
        
        isSigningIn = true
        self.completion = completion
        
        print("[AppleSignInPlugin] Apple Sign In 시작...")
        
        // 메인 스레드에서 실행
        DispatchQueue.main.async {
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            
            print("[AppleSignInPlugin] ASAuthorizationController 생성 완료, performRequests 호출...")
            controller.performRequests()
            print("[AppleSignInPlugin] performRequests 호출 완료")
        }
    }
    
    // MARK: - WKScriptMessageHandler
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("[AppleSignInPlugin] WKScriptMessageHandler 메시지 수신: name=\(message.name), body=\(message.body)")
        
        if message.name == "AppleSignInPlugin" {
            if let body = message.body as? [String: Any],
               let action = body["action"] as? String,
               action == "signIn" {
                
                print("[AppleSignInPlugin] Apple Sign In 요청 받음")
                handleAppleSignIn { [weak self] result in
                    DispatchQueue.main.async {
                        self?.handleAppleSignInResult(result)
                    }
                }
            }
        }
    }
    
    private func handleAppleSignInResult(_ result: Result<AppleSignInResult, Error>) {
        print("[AppleSignInPlugin] handleAppleSignInResult 호출됨")
        
        // 로그인 상태 리셋
        isSigningIn = false
        
        switch result {
        case .success(let signInResult):
            print("[AppleSignInPlugin] Apple Sign In 성공 - JavaScript로 결과 전송 시작")
            
            // JavaScript로 결과 전송
            if let webView = webView {
                let script = """
                console.log('[AppleSignInPlugin] JavaScript에서 결과 수신 시작...');
                
                if (window._appleSignInResolve) {
                    console.log('[AppleSignInPlugin] Promise resolve 함수 발견, 결과 전송...');
                    window._appleSignInResolve({
                        success: true,
                        credential: {
                            idToken: "\(signInResult.idToken)",
                            rawNonce: "\(signInResult.rawNonce)"
                        }
                    });
                    delete window._appleSignInResolve;
                    console.log('[AppleSignInPlugin] 결과 전송 완료, Promise resolve 함수 제거됨');
                } else {
                    console.error('[AppleSignInPlugin] Promise resolve 함수를 찾을 수 없음');
                    console.log('[AppleSignInPlugin] window._appleSignInResolve:', typeof window._appleSignInResolve);
                }
                """
                
                print("[AppleSignInPlugin] JavaScript 스크립트 실행 시작")
                webView.evaluateJavaScript(script) { result, error in
                    if let error = error {
                        print("[AppleSignInPlugin] JavaScript 결과 전송 실패:", error)
                    } else {
                        print("[AppleSignInPlugin] JavaScript 결과 전송 성공")
                    }
                }
            } else {
                print("[AppleSignInPlugin] WebView를 찾을 수 없어 JavaScript 결과 전송 실패")
            }
            
        case .failure(let error):
            print("[AppleSignInPlugin] Apple Sign In 실패 - JavaScript로 에러 전송 시작:", error)
            
            // JavaScript로 에러 전송
            if let webView = webView {
                let script = """
                console.log('[AppleSignInPlugin] JavaScript에서 에러 수신 시작...');
                
                if (window._appleSignInReject) {
                    console.log('[AppleSignInPlugin] Promise reject 함수 발견, 에러 전송...');
                    window._appleSignInReject(new Error("\(error.localizedDescription)"));
                    delete window._appleSignInReject;
                    console.log('[AppleSignInPlugin] 에러 전송 완료, Promise reject 함수 제거됨');
                } else {
                    console.error('[AppleSignInPlugin] Promise reject 함수를 찾을 수 없음');
                    console.log('[AppleSignInPlugin] window._appleSignInReject:', typeof window._appleSignInReject);
                }
                """
                
                print("[AppleSignInPlugin] JavaScript 에러 스크립트 실행 시작")
                webView.evaluateJavaScript(script) { result, error in
                    if let error = error {
                        print("[AppleSignInPlugin] JavaScript 에러 전송 실패:", error)
                    } else {
                        print("[AppleSignInPlugin] JavaScript 에러 전송 성공")
                    }
                }
            } else {
                print("[AppleSignInPlugin] WebView를 찾을 수 없어 JavaScript 에러 전송 실패")
            }
        }
    }
    
    private func findWebView() -> WKWebView? {
        // WebView를 찾는 로직
        if let rootVC = UIApplication.shared.windows.first?.rootViewController {
            for subview in rootVC.view.subviews {
                if let webView = subview as? WKWebView {
                    return webView
                }
                
                // 더 깊은 레벨에서 검색
                for subSubview in subview.subviews {
                    if let webView = subSubview as? WKWebView {
                        return webView
                    }
                }
            }
        }
        return nil
    }
    
    // MARK: - ASAuthorizationControllerDelegate
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
            print("[AppleSignInPlugin] Apple Sign In 성공")
            print("[AppleSignInPlugin] 사용자 ID: \(appleIDCredential.user)")
            print("[AppleSignInPlugin] 이메일: \(appleIDCredential.email ?? "nil")")
            print("[AppleSignInPlugin] 이름: \(appleIDCredential.fullName?.givenName ?? "nil")")
            
            let idToken = String(data: appleIDCredential.identityToken!, encoding: .utf8) ?? ""
            let rawNonce = "nonce" // 실제로는 보안을 위해 랜덤 nonce 사용해야 함
            
            print("[AppleSignInPlugin] ID Token: \(idToken.prefix(50))...")
            
            let result = AppleSignInResult(idToken: idToken, rawNonce: rawNonce)
            
            // 메인 스레드에서 결과 처리
            DispatchQueue.main.async { [weak self] in
                self?.handleAppleSignInResult(.success(result))
            }
        } else {
            let error = NSError(domain: "AppleSignIn", code: -1, userInfo: [NSLocalizedDescriptionKey: "Apple Sign In credential을 가져올 수 없습니다."])
            print("[AppleSignInPlugin] Apple Sign In 실패: \(error)")
            
            DispatchQueue.main.async { [weak self] in
                self?.handleAppleSignInResult(.failure(error))
            }
        }
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        print("[AppleSignInPlugin] Apple Sign In 실패:", error)
        
        DispatchQueue.main.async { [weak self] in
            self?.handleAppleSignInResult(.failure(error))
        }
    }
    
    // MARK: - ASAuthorizationControllerPresentationContextProviding
    
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        print("[AppleSignInPlugin] presentationAnchor 호출됨")
        guard let window = UIApplication.shared.windows.first else {
            print("[AppleSignInPlugin] 윈도우를 찾을 수 없음")
            fatalError("윈도우를 찾을 수 없습니다.")
        }
        print("[AppleSignInPlugin] presentationAnchor 반환: \(window)")
        return window
    }
}

// MARK: - AppleSignInResult

struct AppleSignInResult {
    let idToken: String
    let rawNonce: String
}

// MARK: - GoogleSignInPlugin

class GoogleSignInPlugin: NSObject, WKScriptMessageHandler {
    
    private var webView: WKWebView?
    
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
        print("[GoogleSignInPlugin] WebView 참조 저장됨")
    }
    
    // MARK: - WKScriptMessageHandler
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("[GoogleSignInPlugin] WKScriptMessageHandler 메시지 수신: name=\(message.name), body=\(message.body)")
        
        if message.name == "GoogleSignInPlugin" {
            if let body = message.body as? [String: Any],
               let action = body["action"] as? String,
               action == "signIn" {
                
                print("[GoogleSignInPlugin] Google Sign In 요청 받음")
                handleGoogleSignIn()
            }
        }
    }
    
    private func handleGoogleSignIn() {
        print("[GoogleSignInPlugin] Google Sign In 시작...")
        
        // 메인 스레드에서 실행
        guard let presentingViewController = getPresentingViewController() else {
            print("[GoogleSignInPlugin] Presenting ViewController를 찾을 수 없음")
            sendErrorToJavaScript("Presenting ViewController를 찾을 수 없습니다")
            return
        }
        
        GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { [weak self] (signInResult: GIDSignInResult?, error: Error?) in
            if let error = error {
                print("[GoogleSignInPlugin] Google Sign In 실패:", error)
                self?.sendErrorToJavaScript(error.localizedDescription)
            } else if let signInResult = signInResult {
                print("[GoogleSignInPlugin] Google Sign In 성공")
                self?.handleGoogleSignInSuccess(signInResult.user)
            } else {
                print("[GoogleSignInPlugin] Google Sign In 결과가 없음")
                self?.sendErrorToJavaScript("Google Sign In 결과가 없습니다")
            }
        }
    }
    
    private func handleGoogleSignInSuccess(_ result: GIDGoogleUser) {
        print("[GoogleSignInPlugin] Google Sign In 성공 처리 시작")
        
        let user = result
        let profile = user.profile
        
        print("[GoogleSignInPlugin] 사용자 ID: \(user.userID ?? "nil")")
        print("[GoogleSignInPlugin] 이메일: \(profile?.email ?? "nil")")
        print("[GoogleSignInPlugin] 이름: \(profile?.name ?? "nil")")
        
        // Firebase Auth와 연동
        self.linkWithFirebaseAuth(result) { [weak self] firebaseResult in
            DispatchQueue.main.async {
                if let firebaseResult = firebaseResult {
                    print("[GoogleSignInPlugin] Firebase Auth 연동 성공: \(firebaseResult.user.uid)")
                    
                    // 사용자 정보 구성
                    let userInfo: [String: Any] = [
                        "id": firebaseResult.user.uid,
                        "email": firebaseResult.user.email ?? "",
                        "name": firebaseResult.user.displayName ?? "",
                        "picture": firebaseResult.user.photoURL?.absoluteString ?? "",
                        "verified_email": firebaseResult.user.isEmailVerified
                    ]
                    
                    let tokens: [String: Any] = [
                        "access_token": result.accessToken.tokenString,
                        "id_token": result.idToken?.tokenString ?? ""
                    ]
                    
                    let resultData: [String: Any] = [
                        "success": true,
                        "user": userInfo,
                        "tokens": tokens,
                        "firebase_user": [
                            "uid": firebaseResult.user.uid,
                            "email": firebaseResult.user.email ?? "",
                            "displayName": firebaseResult.user.displayName ?? "",
                            "photoURL": firebaseResult.user.photoURL?.absoluteString ?? ""
                        ]
                    ]
                    
                    // JavaScript로 결과 전송
                    self?.sendSuccessToJavaScript(resultData)
                } else {
                    print("[GoogleSignInPlugin] Firebase Auth 연동 실패")
                    self?.sendErrorToJavaScript("Firebase Auth 연동에 실패했습니다")
                }
            }
        }
    }
    
    private func linkWithFirebaseAuth(_ result: GIDGoogleUser, completion: @escaping (AuthDataResult?) -> Void) {
        print("[GoogleSignInPlugin] Firebase Auth 연동 시작")
        
        guard let idToken = result.idToken?.tokenString else {
            print("[GoogleSignInPlugin] ID Token을 찾을 수 없음")
            completion(nil)
            return
        }
        
        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.accessToken.tokenString)
        
        Auth.auth().signIn(with: credential) { authResult, error in
            if let error = error {
                print("[GoogleSignInPlugin] Firebase Auth 로그인 실패: \(error.localizedDescription)")
                completion(nil)
            } else if let authResult = authResult {
                print("[GoogleSignInPlugin] Firebase Auth 로그인 성공: \(authResult.user.uid)")
                completion(authResult)
            } else {
                print("[GoogleSignInPlugin] Firebase Auth 결과가 없음")
                completion(nil)
            }
        }
    }
    
    private func sendSuccessToJavaScript(_ data: [String: Any]) {
        guard let webView = webView else {
            print("[GoogleSignInPlugin] WebView를 찾을 수 없어 JavaScript 결과 전송 실패")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            
            let script = """
            console.log('[GoogleSignInPlugin] JavaScript에서 결과 수신 시작...');
            
            if (window._googleSignInResolve) {
                console.log('[GoogleSignInPlugin] Promise resolve 함수 발견, 결과 전송...');
                window._googleSignInResolve(\(jsonString));
                delete window._googleSignInResolve;
                console.log('[GoogleSignInPlugin] 결과 전송 완료, Promise resolve 함수 제거됨');
            } else {
                console.error('[GoogleSignInPlugin] Promise resolve 함수를 찾을 수 없음');
                console.log('[GoogleSignInPlugin] window._googleSignInResolve:', typeof window._googleSignInResolve);
            }
            """
            
            print("[GoogleSignInPlugin] JavaScript 성공 스크립트 실행 시작")
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("[GoogleSignInPlugin] JavaScript 결과 전송 실패:", error)
                } else {
                    print("[GoogleSignInPlugin] JavaScript 결과 전송 성공")
                }
            }
        } catch {
            print("[GoogleSignInPlugin] JSON 직렬화 실패:", error)
            sendErrorToJavaScript("JSON 직렬화 실패: \(error.localizedDescription)")
        }
    }
    
    private func sendErrorToJavaScript(_ errorMessage: String) {
        guard let webView = webView else {
            print("[GoogleSignInPlugin] WebView를 찾을 수 없어 JavaScript 에러 전송 실패")
            return
        }
        
        let script = """
        console.log('[GoogleSignInPlugin] JavaScript에서 에러 수신 시작...');
        
        if (window._googleSignInReject) {
            console.log('[GoogleSignInPlugin] Promise reject 함수 발견, 에러 전송...');
            window._googleSignInReject(new Error("\(errorMessage)"));
            delete window._googleSignInReject;
            console.log('[GoogleSignInPlugin] 에러 전송 완료, Promise reject 함수 제거됨');
        } else {
            console.error('[GoogleSignInPlugin] Promise reject 함수를 찾을 수 없음');
            console.log('[GoogleSignInPlugin] window._googleSignInReject:', typeof window._googleSignInReject);
        }
        """
        
        print("[GoogleSignInPlugin] JavaScript 에러 스크립트 실행 시작")
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("[GoogleSignInPlugin] JavaScript 에러 전송 실패:", error)
            } else {
                print("[GoogleSignInPlugin] JavaScript 에러 전송 성공")
            }
        }
    }
    
    private func getPresentingViewController() -> UIViewController? {
        // 현재 화면에 표시된 ViewController 찾기
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            return window.rootViewController
        }
        return nil
    }
}
