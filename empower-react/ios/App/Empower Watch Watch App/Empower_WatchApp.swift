//
//  Empower_WatchApp.swift
//  Empower Watch Watch App
//
//  Created by Emma Scheck on 2026-08-06.
//
//  Owns the PlanStore and the WatchConnectivity link back to the iPhone app. The phone (the
//  Capacitor host, via the WatchBridge plugin) pushes today's phase-based plan as JSON; we decode
//  it, cache it, and publish it to the UI. See WATCH_APP_SPEC.md for the wire format.
//

import SwiftUI
import Combine
import WatchConnectivity

@main
struct Empower_Watch_Watch_AppApp: App {
    @StateObject private var store = PlanStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}

// MARK: - PlanStore
// Single source of truth for what the watch shows today. Receives the plan from the phone over
// WatchConnectivity, falls back to the last cached plan (so it works offline / on launch), and
// finally to the labelled sample so the UI is never empty.
final class PlanStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published var plan: TodayPlan = sampleToday
    /// True once a real plan from the phone (live or cached) has been applied — drives the
    /// "sample plan" footer so we never imply sample data is the user's real plan.
    @Published var hasLiveData: Bool = false

    private let cacheKey = "empower.lastPlanJSON"

    override init() {
        super.init()
        loadCachedPlan()
        activateSession()
    }

    // A store pre-seeded with sample data, for SwiftUI previews (no live session).
    static var preview: PlanStore {
        let s = PlanStore()
        return s
    }

    // MARK: Session

    private func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: Decode + apply

    /// Decode the phone payload. We accept either the plan object directly or `{ "planJSON": "…" }`
    /// carrying a JSON string, since applicationContext/userInfo values must be property-list types.
    private func apply(_ context: [String: Any]) {
        if context["clearPlan"] as? Bool == true {
            DispatchQueue.main.async {
                UserDefaults.standard.removeObject(forKey: self.cacheKey)
                self.plan = sampleToday
                self.hasLiveData = false
            }
            return
        }
        var data: Data?
        if let jsonString = context["planJSON"] as? String {
            data = jsonString.data(using: .utf8)
        } else if JSONSerialization.isValidJSONObject(context) {
            data = try? JSONSerialization.data(withJSONObject: context)
        }
        guard let data, let decoded = try? JSONDecoder().decode(TodayPlan.self, from: data), isCurrent(decoded) else { return }

        DispatchQueue.main.async {
            self.plan = decoded
            self.hasLiveData = true
            UserDefaults.standard.set(String(data: data, encoding: .utf8), forKey: self.cacheKey)
        }
    }

    private func loadCachedPlan() {
        guard let json = UserDefaults.standard.string(forKey: cacheKey),
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(TodayPlan.self, from: data),
              isCurrent(decoded) else {
            UserDefaults.standard.removeObject(forKey: cacheKey)
            return
        }
        plan = decoded
        hasLiveData = true
    }

    private func isCurrent(_ plan: TodayPlan) -> Bool {
        guard let date = plan.date else { return false }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return date == formatter.string(from: Date())
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        // On activation, adopt whatever the phone last set as the application context.
        if !session.receivedApplicationContext.isEmpty {
            apply(session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        apply(userInfo)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }
}
