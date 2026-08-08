//
//  WatchBridge.swift
//  App (iPhone host)
//
//  Capacitor plugin that forwards today's phase-based plan from the web app (JS) to the paired
//  Apple Watch over WatchConnectivity. The JS side (src/lib/watchBridge.js) calls `sendPlan`
//  with the payload built by src/lib/watchPayload.js; we hand it to the watch as the session's
//  application context, which the watch decodes in PlanStore. See WATCH_APP_SPEC.md.
//
//  IMPORTANT: Capacitor does NOT auto-discover a CAPBridgedPlugin defined in the app target
//  (only plugins shipped as Swift packages). This plugin is registered explicitly in
//  SceneDelegate's MainViewController.capacitorDidLoad() via registerPluginInstance(WatchBridge()).
//

import Foundation
import Capacitor
import WatchConnectivity

@objc(WatchBridge)
public class WatchBridge: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchBridge"
    public let jsName = "WatchBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sendPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isReachable", returnType: CAPPluginReturnPromise)
    ]

    // The most recent plan JSON, always retained. Lets us (a) flush the first send of a session
    // once activation finishes — activation is async, so a cold-launch send often arrives too
    // early — and (b) resend when a watch is newly paired/installed. Never cleared.
    private var lastPlanJSON: String?

    private var session: WCSession? {
        guard WCSession.isSupported() else { return nil }
        let s = WCSession.default
        if s.delegate == nil { s.delegate = self }
        if s.activationState != .activated { s.activate() }
        return s
    }

    override public func load() {
        _ = session   // activate as soon as the plugin is created
    }

    /// Push the plan over every available channel so it lands regardless of watch state:
    /// - updateApplicationContext: latest-state, delivered on the watch's next launch.
    /// - transferUserInfo: FIFO queue, delivered in the background even if the watch app is
    ///   asleep or not currently reachable. This is the reliable one; app context alone can be
    ///   missed if the watch never relaunches.
    private func deliver(_ json: String, over session: WCSession) {
        try? session.updateApplicationContext(["planJSON": json])
        session.transferUserInfo(["planJSON": json])
    }

    /// sendPlan({ plan: { phase, workouts:[…], date } }) — pushes today's plan to the watch.
    @objc func sendPlan(_ call: CAPPluginCall) {
        guard let plan = call.getObject("plan"),
              let data = try? JSONSerialization.data(withJSONObject: plan),
              let json = String(data: data, encoding: .utf8) else {
            call.reject("Missing or invalid plan payload")
            return
        }
        lastPlanJSON = json
        guard let session = session else {
            call.reject("Watch connectivity not supported on this device")
            return
        }
        // Not activated yet: it's retained in lastPlanJSON and flushed on activation. Not an error.
        guard session.activationState == .activated else {
            call.resolve(["sent": false, "queued": true, "reason": "session activating"])
            return
        }
        guard session.isPaired else { call.resolve(["sent": false, "reason": "no paired watch"]); return }
        guard session.isWatchAppInstalled else { call.resolve(["sent": false, "reason": "watch app not installed"]); return }

        deliver(json, over: session)
        call.resolve([
            "sent": true,
            "reachable": session.isReachable,
            "paired": session.isPaired,
            "watchAppInstalled": session.isWatchAppInstalled
        ])
    }

    @objc func isReachable(_ call: CAPPluginCall) {
        let s = session
        call.resolve([
            "activated": s?.activationState == .activated,
            "paired": s?.isPaired ?? false,
            "watchAppInstalled": s?.isWatchAppInstalled ?? false,
            "reachable": s?.isReachable ?? false
        ])
    }

    // MARK: WCSessionDelegate
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Flush the last plan that was requested before the session was ready.
        if activationState == .activated, let json = lastPlanJSON,
           session.isPaired, session.isWatchAppInstalled {
            deliver(json, over: session)
        }
    }

    // A newly-installed/paired watch fires this; resend the last plan so it isn't left on the sample.
    public func sessionWatchStateDidChange(_ session: WCSession) {
        if let json = lastPlanJSON, session.isPaired, session.isWatchAppInstalled {
            deliver(json, over: session)
        }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate so a newly-paired watch still receives plans.
        WCSession.default.activate()
    }
}
