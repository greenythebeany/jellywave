import UIKit
import Capacitor
import AVFoundation
import MediaPlayer

// The app's own bridge view controller (set as the root in Main.storyboard),
// only so the app-local native plugins below get registered -- Capacitor
// auto-registers plugins from npm packages, not ones that live in the app.
class JellyWaveViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SystemVolumePlugin())
    }
}

// iOS counterpart of Android's SystemVolumePlugin.java: lets the in-app
// volume slider show and set the phone's real volume and follow the
// hardware buttons. (WebKit ignores <audio>.volume on iOS, so an in-app
// level was never possible here anyway.) Levels are 0...1 fractions.
@objc(SystemVolumePlugin)
public class SystemVolumePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SystemVolumePlugin"
    public let jsName = "JellyWaveSystemVolume"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise)
    ]

    private var observation: NSKeyValueObservation?

    // iOS has no public API to set the system volume; the standard approach
    // is an MPVolumeView's internal slider. Kept off-screen (but in the view
    // hierarchy, which also stops the system volume HUD from popping up
    // over the app while our own slider is in use).
    private lazy var volumeView: MPVolumeView = {
        let view = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 100, height: 40))
        view.alpha = 0.01
        bridge?.viewController?.view.addSubview(view)
        return view
    }()

    override public func load() {
        let session = AVAudioSession.sharedInstance()
        // outputVolume only reports changes while the session is active.
        try? session.setActive(true)
        observation = session.observe(\.outputVolume, options: [.new]) { [weak self] _, change in
            guard let level = change.newValue else { return }
            self?.notifyListeners("volumeChange", data: ["level": Double(level)])
        }
        DispatchQueue.main.async { _ = self.volumeView }
    }

    deinit {
        observation?.invalidate()
    }

    @objc func getVolume(_ call: CAPPluginCall) {
        call.resolve(["level": Double(AVAudioSession.sharedInstance().outputVolume)])
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        let level = Float(max(0, min(1, call.getDouble("level") ?? 0.5)))
        DispatchQueue.main.async {
            guard let slider = self.volumeView.subviews.compactMap({ $0 as? UISlider }).first else {
                call.reject("Volume control unavailable")
                return
            }
            slider.setValue(level, animated: false)
            slider.sendActions(for: .valueChanged)
            call.resolve(["level": Double(level)])
        }
    }
}
