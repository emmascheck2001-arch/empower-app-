//
//  WatchBridge.swift
//  App (iPhone host)
//
//  Capacitor plugin that forwards today's phase-based plan from the web app (JS) to the paired
//  Apple Watch over WatchConnectivity. The JS side (src/lib/watchBridge.js) calls `sendPlan`
//  with the payload built by src/lib/watchPayload.js; we hand it to the watch as the session's
//  application context, which the watch decodes in PlanStore. See WATCH_APP_SPEC.md.
//
//  Capacitor 6+ auto-registers plugins that conform to CAPBridgedPlugin, so no manual
//  registration call is needed — it just has to be compiled into the App target.
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

    /// sendPlan({ plan: { phase, workouts:[…], date } }) — pushes the plan to the watch.
    /// Uses updateApplicationContext (latest-state semantics: a new plan overwrites the old,
    /// and the watch gets it on next launch even if it was asleep when we sent it).
    @objc func sendPlan(_ call: CAPPluginCall) {
        guard let session = session, session.activationState == .activated else {
            call.reject("Watch session not available on this device")
            return
        }
        guard session.isPaired, session.isWatchAppInstalled else {
            call.reject("No paired Apple Watch with Em~power installed")
            return
        }
        guard let plan = call.getObject("plan"),
              let data = try? JSONSerialization.data(withJSONObject: plan),
              let json = String(data: data, encoding: .utf8) else {
            call.reject("Missing or invalid plan payload")
            return
        }
        do {
            // Carry the plan as a JSON string so nested arrays/objects survive the property-list
            // constraint on application-context values.
            try session.updateApplicationContext(["planJSON": json])
            call.resolve(["sent": true])
        } catch {
            call.reject("Failed to send plan to watch: \(error.localizedDescription)")
        }
    }

    @objc func isReachable(_ call: CAPPluginCall) {
        let s = session
        call.resolve([
            "paired": s?.isPaired ?? false,
            "watchAppInstalled": s?.isWatchAppInstalled ?? false,
            "reachable": s?.isReachable ?? false
        ])
    }

    // MARK: WCSessionDelegate (required on iOS; no-ops we don't need here)
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate so a newly-paired watch still receives plans.
        WCSession.default.activate()
    }
}
