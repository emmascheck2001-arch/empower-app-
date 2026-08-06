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
    // Non-nil ONLY when the heart rate is high for the user's phase — this is the one time HR
    // surfaces on screen (per the design: HR stays out of the way and only pops up as a flag).
    @Published var hrFlag: String? = nil

    var age: Int = 30            // from the phone payload; used to estimate max HR
    var phase: String = ""       // current cycle phase, for phase-aware flag wording
    // Estimated max HR (220 − age), floored so a bad age never makes the threshold absurd.
    private var maxHR: Double { Double(max(140, 220 - age)) }

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    private var startDate: Date?

    // MARK: Authorization

    /// Ask for permission to read heart rate + write the workout. The OS only asks once; after
    /// that this resolves silently. Toggles must be granted by the user in the sheet.
    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            errorMessage = "Health data isn't available on this device."
            return
        }
        let typesToShare: Set = [HKQuantityType.workoutType()]
        let typesToRead: Set = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] ok, error in
            DispatchQueue.main.async {
                self?.authorized = ok
                if let error { self?.errorMessage = error.localizedDescription }
            }
        }
    }

    // MARK: Session control

    func start(age: Int, phase: String) {
        self.age = age
        self.phase = phase
        let config = HKWorkoutConfiguration()
        config.activityType = .other        // generic; phase workouts span strength/cardio/yoga
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

    // HR only appears on screen when it crosses a high threshold (≈90% of estimated max HR).
    // Below that it stays silent. In the luteal phase HR naturally runs higher, so we say so in
    // the flag rather than nagging — the flag means "genuinely high," not "higher than follicular".
    private func evaluateFlag(_ current: Double) {
        guard current > 0 else { return }
        let high = maxHR * 0.90
        if current >= high {
            let luteal = phase.lowercased().contains("luteal")
            let tail = luteal
                ? "Some extra elevation is normal in your luteal phase, but this is genuinely high — ease back."
                : "Ease back and let it settle."
            hrFlag = "Heart rate high · \(Int(current)) bpm. \(tail)"
        } else if current < high - 6 {
            hrFlag = nil   // recovered — hide it again
        }
    }
}
