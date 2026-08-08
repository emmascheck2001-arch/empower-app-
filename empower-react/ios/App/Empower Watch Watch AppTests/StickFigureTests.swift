//
//  StickFigureTests.swift
//  Empower Watch Watch AppTests
//
//  Covers svgType(for:) — the exercise-name → stick-figure mapping. Matching is tokenized
//  (whole-word), so these tests pin the exact figure for every real exercise name the phone
//  sends AND guard the historical false-positives ("trunk" ≠ run, "bicycle" ≠ cycle,
//  "single-leg deadlift" ≠ pilates). If you add or rename an exercise in exerciseData.js or
//  watchWorkouts.js, add its case here.
//
//  NOTE: this file needs a unit-test target for the watch app in App.xcodeproj
//  (Empower Watch Watch AppTests) with `@testable import`. It runs in CI once that target exists.
//

import XCTest
@testable import Empower_Watch_Watch_App

final class StickFigureTests: XCTestCase {
    // Every real name → its expected figure.
    private let expected: [String: String] = [
        // Strength (exerciseData.js)
        "Band pull-apart": "facepull", "Barbell row": "row", "Barbell squat": "squat",
        "Bench press": "push", "Bicep curl": "curl", "Bulgarian split squat": "splitsquat",
        "Cable face pull": "facepull", "Cable row": "row", "Calf raise": "calf", "Deadlift": "hinge",
        "Dumbbell lateral raise": "lateralraise", "Dumbbell row": "row", "Dumbbell shoulder press": "press",
        "Face pull": "facepull", "Glute bridge": "thrust", "Goblet squat": "squat", "Hip thrust": "thrust",
        "Incline dumbbell press": "push", "Leg curl": "legcurl", "Leg press": "legpress",
        "Nordic hamstring curl": "legcurl", "Overhead press": "press", "Plank": "plank", "Pull-up": "pullup",
        "Push-up": "push", "Romanian deadlift": "hinge", "Tricep dip": "dip", "Tricep pushdown": "pushdown",
        "Walking lunge": "lunge", "Weighted pull-up": "pullup",
        // Cardio / HIIT / Pilates / Yoga (watchWorkouts.js)
        "Steady run": "run", "Steady ride": "cycle", "Steady swim": "swim", "Steady walk": "march",
        "Child's pose": "childpose", "Cat-cow": "catcow", "Supine twist": "twistpose", "Savasana": "savasana",
        "Warm up": "march", "Work interval": "jumpingjack", "Recover": "march", "Cool down": "march",
        "The hundred": "hundred", "Roll-up": "rollup", "Single-leg stretch": "singleleg",
        "Side plank": "plank", "Spine stretch": "spinestretch",
        // Historical false-positives that must NOT regress
        "Trunk rotation": "stand", "Bicycle crunch": "plank", "Single-leg deadlift": "hinge",
        "Overhead tricep extension": "pushdown", "Standing calf raise": "calf",
    ]

    func testEveryExerciseNameMapsToExpectedFigure() {
        for (name, want) in expected {
            XCTAssertEqual(svgType(for: name), want, "\"\(name)\" should map to \(want)")
        }
    }

    // Every mapped figure must actually exist in FIGURES (otherwise the view silently falls back
    // to "stand"). "stand" is the intentional default and always present.
    func testEveryMappedFigureHasPoseData() {
        for name in expected.keys {
            let type = svgType(for: name)
            XCTAssertNotNil(FIGURES[type], "figure \"\(type)\" for \"\(name)\" is missing from FIGURES")
        }
    }
}
