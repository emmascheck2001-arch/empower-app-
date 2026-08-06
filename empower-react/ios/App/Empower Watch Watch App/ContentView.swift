//
//  ContentView.swift
//  Empower Watch Watch App
//
//  Em~power on the wrist: today's phase-based workouts, pick one, guided detail.
//  Real data arrives from the phone over WatchConnectivity (see WATCH_APP_SPEC.md); until the
//  first payload lands we show a labelled sample so the UI is never empty. "Start workout" opens
//  the live heart-rate session (still a placeholder — that's the next build).
//

import SwiftUI

// MARK: - Brand
let empowerGold = Color(red: 0.78, green: 0.72, blue: 0.60)   // #c8b89a

// MARK: - Models
// Codable, decoding 1:1 from the phone payload documented in WATCH_APP_SPEC.md.
// `id` is intentionally omitted from CodingKeys: it's a client-side identity for SwiftUI's
// ForEach, not part of the wire format, so it keeps its default UUID on decode.

struct WatchExercise: Identifiable, Codable {
    var id = UUID()
    let name: String
    let guide: String     // weight or pace guide, e.g. "12–16 kg" or "conversational"
    let reps: String      // "3 × 10" or a duration like "35 min"

    enum CodingKeys: String, CodingKey { case name, guide, reps }
}

struct WatchWorkout: Identifiable, Codable {
    var id = UUID()
    let activity: String  // Run / Walk / Cycle / Swim / Gym / Yoga / Pilates / HIIT / Rest
    let title: String
    let detail: String    // e.g. "Strength · recovery-leaning"
    let exercises: [WatchExercise]

    enum CodingKeys: String, CodingKey { case activity, title, detail, exercises }
}

struct TodayPlan: Codable {
    let phase: String                 // user-facing sub-phase, e.g. "Mid luteal"
    let workouts: [WatchWorkout]
    var date: String? = nil           // ISO yyyy-MM-dd the plan was built for (staleness check)
    var age: Int? = nil               // from the phone (for the heart-rate flag threshold)

    enum CodingKeys: String, CodingKey { case phase, workouts, date, age }
}

// TEMP sample — shown (labelled) only until the first real phone→watch payload arrives.
let sampleToday = TodayPlan(
    phase: "Luteal phase",
    workouts: [
        WatchWorkout(activity: "Gym", title: "Lower body", detail: "Strength · recovery-leaning",
                     exercises: [
                        WatchExercise(name: "Goblet squat", guide: "12–16 kg", reps: "3 × 10"),
                        WatchExercise(name: "Romanian deadlift", guide: "20–30 kg", reps: "3 × 8"),
                        WatchExercise(name: "Glute bridge", guide: "bodyweight", reps: "3 × 12"),
                     ]),
        WatchWorkout(activity: "Walk", title: "Zone 2 walk", detail: "35 min · easy pace",
                     exercises: [WatchExercise(name: "Steady walk", guide: "conversational", reps: "35 min")]),
        WatchWorkout(activity: "Yoga", title: "Restorative flow", detail: "20 min · calm",
                     exercises: [
                        WatchExercise(name: "Child's pose", guide: "breathe deep", reps: "2 min"),
                        WatchExercise(name: "Cat–cow", guide: "slow, with breath", reps: "2 min"),
                        WatchExercise(name: "Supine twist", guide: "each side", reps: "3 min"),
                        WatchExercise(name: "Savasana", guide: "let go", reps: "5 min"),
                     ]),
    ],
    age: 30
)

func activityIcon(_ a: String) -> String {
    switch a {
    case "Run": return "figure.run"
    case "Walk": return "figure.walk"
    case "Cycle": return "figure.outdoor.cycle"
    case "Swim": return "figure.pool.swim"
    case "Gym": return "dumbbell.fill"
    case "Yoga": return "figure.yoga"
    case "Pilates": return "figure.pilates"
    case "HIIT": return "flame.fill"
    case "Rest": return "moon.zzz.fill"
    default: return "figure.strengthtraining.traditional"
    }
}

// MARK: - Today
struct ContentView: View {
    @EnvironmentObject private var store: PlanStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(store.plan.workouts) { w in
                        NavigationLink(destination: WorkoutDetailView(workout: w, phase: store.plan.phase, age: store.plan.age ?? 30)) {
                            HStack(spacing: 10) {
                                Image(systemName: activityIcon(w.activity))
                                    .foregroundStyle(empowerGold)
                                    .frame(width: 22)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(w.title).font(.headline)
                                    Text(w.detail).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Today").font(.title3.bold()).foregroundStyle(.primary)
                        Text(store.plan.phase).font(.caption).foregroundStyle(empowerGold)
                    }
                    .textCase(nil)
                    .padding(.bottom, 4)
                } footer: {
                    if !store.hasLiveData {
                        Text("Sample plan — open Em~power on your iPhone to sync today's workouts.")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Em~power")
        }
        .tint(empowerGold)
    }
}

// MARK: - Workout detail
struct WorkoutDetailView: View {
    let workout: WatchWorkout
    let phase: String
    let age: Int

    var body: some View {
        List {
            // Guidance-only card (no per-exercise breakdown synced yet): show the day's detail.
            if workout.exercises.isEmpty {
                Text(workout.detail)
                    .font(.callout)
                    .foregroundStyle(.primary)
                    .padding(.vertical, 2)
            }

            ForEach(workout.exercises) { e in
                VStack(alignment: .leading, spacing: 3) {
                    Text(e.name).font(.headline)
                    HStack {
                        Label(e.guide, systemImage: "scalemass")
                        if !e.reps.isEmpty {
                            Spacer()
                            Text(e.reps).foregroundStyle(empowerGold)
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 1)
            }

            NavigationLink(destination: LiveWorkoutView(workout: workout, phase: phase, age: age)) {
                Label("Start guided workout", systemImage: "play.fill")
                    .font(.headline)
                    .foregroundStyle(empowerGold)
            }
        }
        .navigationTitle(workout.title)
    }
}

#Preview {
    ContentView().environmentObject(PlanStore.preview)
}
