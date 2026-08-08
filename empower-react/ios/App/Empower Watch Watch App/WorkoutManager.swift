//
//  WorkoutManager.swift
//  Empower Watch Watch App
//
//  Live heart-rate session for the watch. Starts an HKWorkoutSession + HKLiveWorkoutBuilder and
//  streams the live heart rate off the watch's sensor — the one place a real-time BPM actually
//  exists (Apple Health only stores periodic samples; it can't hand out a live rate). Powers the
//  "Start workout" screen. See WATCH_APP_SPEC.md → roadmap.
//

import Foundation
import Combine
import HealthKit

final class WorkoutManager: NSObject, ObservableObject {
    @Published var heartRate: Double = 0          // live BPM (kept internal — not shown unless flagged)
    @Published var averageHeartRate: Double = 0   // session average
    @Published var elapsed: TimeInterval = 0
    @Published var running = false
    @Published var authorized = false
    @Published var errorMessage: String?
    // Non-nil only in an estimated high-effort zone. It is explicitly not a safety threshold.
    @Published var hrFlag: String? = nil

    var age: Int = 30            // from the phone payload; used to estimate max HR
    // Estimated max HR (220 − age) is used only for an informational effort-zone notice.
    private var maxHR: Double { Double(max(140, 220 - age)) }

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    private var startDate: Date?

    // MARK: Authorization

    /// Ask for permission to read heart rate + write the workout. The OS only asks once; after
    /// that this resolves silently. Toggles must be granted by the user in the sheet.
    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            errorMessage = "Health data isn't available on this device."
            completion(false)
            return
        }
        let typesToShare: Set = [HKQuantityType.workoutType()]
        let typesToRead: Set = [HKQuantityType(.heartRate)]
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] ok, error in
            DispatchQueue.main.async {
                self?.authorized = ok
                if let error { self?.errorMessage = error.localizedDescription }
                completion(ok && error == nil)
            }
        }
    }

    // MARK: Session control

    func start(age: Int, activity: String) {
        self.age = age
        let config = HKWorkoutConfiguration()
        config.activityType = activityType(activity)
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self

            self.session = session
            self.builder = builder

            let start = Date()
            self.startDate = start
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { [weak self] _, error in
                DispatchQueue.main.async {
                    if let error { self?.errorMessage = error.localizedDescription; return }
                    self?.running = true
                    self?.startTimer()
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func activityType(_ activity: String) -> HKWorkoutActivityType {
        switch activity.lowercased() {
        case "run", "running": return .running
        case "walk", "walking", "hiking": return .walking
        case "cycle", "cycling": return .cycling
        case "swim", "swimming": return .swimming
        case "gym", "strength": return .traditionalStrengthTraining
        case "yoga": return .yoga
        case "pilates": return .pilates
        case "hiit": return .highIntensityIntervalTraining
        default: return .other
        }
    }

    func end() {
        timer?.invalidate(); timer = nil
        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in }
            DispatchQueue.main.async { self?.running = false }
        }
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self, let start = self.startDate else { return }
            self.elapsed = Date().timeIntervalSince(start)
        }
    }

    var elapsedString: String {
        let s = Int(elapsed)
        return String(format: "%02d:%02d", s / 60, s % 60)
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession,
                        didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState,
                        date: Date) {
        DispatchQueue.main.async { self.running = (toState == .running) }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.errorMessage = error.localizedDescription }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                        didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }
        guard collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType) else { return }
        let unit = HKUnit.count().unitDivided(by: .minute())
        let current = stats.mostRecentQuantity()?.doubleValue(for: unit) ?? 0
        let avg = stats.averageQuantity()?.doubleValue(for: unit) ?? 0
        DispatchQueue.main.async {
            if current > 0 { self.heartRate = current }
            if avg > 0 { self.averageHeartRate = avg }
            self.evaluateFlag(current)
        }
    }

    // Informational only: formulas cannot determine whether a heart rate is safe for an individual.
    private func evaluateFlag(_ current: Double) {
        guard current > 0 else { return }
        let high = maxHR * 0.95
        if current >= high {
            hrFlag = "Estimated high-effort zone · \(Int(current)) bpm. This is not a safety limit. Ease back if this effort is not intentional or you feel unwell."
        } else if current < high - 6 {
            hrFlag = nil   // recovered — hide it again
        }
    }
}
