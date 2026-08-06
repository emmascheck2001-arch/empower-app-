//
//  LiveWorkoutView.swift
//  Empower Watch Watch App
//
//  The live heart-rate session UI. Shows the real-time BPM off the watch sensor, elapsed time,
//  and a phase-aware note so the number is framed by where the user is in her cycle (e.g. a
//  higher luteal HR is normal physiology, not lost fitness). Replaces the old placeholder.
//

import SwiftUI

// Short, cited phase framing — mirrors the phone app's science (never scolds a higher HR).
func phaseHeartNote(_ phase: String) -> String {
    let p = phase.lowercased()
    if p.contains("menstrual") {
        return "Keep it gentle — movement eases cramps today."
    }
    if p.contains("luteal") {
        return "Your heart rate runs a little higher in the luteal phase. That's real physiology, not lost fitness — train to how you feel."
    }
    if p.contains("ovulat") || p.contains("follicular") {
        return "A strong training window. If you feel good, this is a great day to push."
    }
    return "Train to how you feel today."
}

struct LiveWorkoutView: View {
    let phase: String
    let workoutTitle: String
    @StateObject private var manager = WorkoutManager()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if !manager.running {
                    // Pre-start / authorize
                    Text(phaseHeartNote(phase))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    Button {
                        manager.requestAuthorization()
                        manager.start()
                    } label: {
                        Label("Start heart-rate session", systemImage: "heart.fill")
                            .font(.headline)
                            .foregroundStyle(empowerGold)
                    }
                    .padding(.top, 4)
                } else {
                    // Live
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(.red)
                            .symbolEffect(.pulse, options: .repeating)
                        Text(manager.heartRate > 0 ? "\(Int(manager.heartRate))" : "—")
                            .font(.system(size: 46, weight: .bold, design: .rounded))
                            .contentTransition(.numericText())
                        Text("BPM").font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.top, 4)

                    HStack(spacing: 14) {
                        stat("Time", manager.elapsedString)
                        if manager.averageHeartRate > 0 {
                            stat("Avg", "\(Int(manager.averageHeartRate))")
                        }
                    }

                    Text(phaseHeartNote(phase))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 4)

                    Button(role: .destructive) {
                        manager.end()
                    } label: {
                        Label("End", systemImage: "stop.fill").font(.headline)
                    }
                    .padding(.top, 2)
                }

                if let msg = manager.errorMessage {
                    Text(msg).font(.caption2).foregroundStyle(.orange).multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle(workoutTitle)
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.headline).foregroundStyle(empowerGold)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}

#Preview {
    LiveWorkoutView(phase: "Mid luteal", workoutTitle: "Lower body")
}
