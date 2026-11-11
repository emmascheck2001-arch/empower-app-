import { describe, expect, it } from 'vitest'
import { buildTodayFoodPlan } from './nutritionPlan'

describe('today food plan', () => {
  it('rotates through practical meal plans without changing the active phase focus', () => {
    const plans = [0, 1].map(seed => buildTodayFoodPlan('Luteal', [], seed))
    expect(new Set(plans.map(plan => plan.meals.map(meal => meal.title).join('|'))).size).toBe(2)
    expect(plans.every(plan => plan.focus.includes('protein'))).toBe(true)
  })

  it('shows genuinely different meal choices for each phase', () => {
    const mealNames = phase => buildTodayFoodPlan(phase, [], 0).meals.slice(0, 3).map(meal => meal.title).join('|')
    expect(mealNames('Menstrual')).not.toBe(mealNames('Follicular'))
    expect(mealNames('Follicular')).not.toBe(mealNames('Ovulatory'))
    expect(mealNames('Ovulatory')).not.toBe(mealNames('Luteal'))
    expect(mealNames('Luteal')).not.toBe(mealNames('Perimenopause'))
  })

  it('uses plant-based protein choices for vegan plans', () => {
    const plan = buildTodayFoodPlan('Menstrual', ['vegan'], 0)
    expect(plan.meals.map(meal => `${meal.detail} ${meal.swaps.join(' ')}`).join(' ')).toMatch(/tofu|lentil|soy/i)
  })

  it('offers a non-dairy yogurt option without assuming soy is wanted', () => {
    const plan = buildTodayFoodPlan('Follicular', ['dairy_free'], 0)
    expect(plan.meals[0].detail).toContain('coconut or pea-protein yogurt')
  })

  it('adds a flexible carb-plus-protein snack in the luteal phase without prescribing calories', () => {
    const plan = buildTodayFoodPlan('Luteal', [], 0)
    const snack = plan.meals.find(meal => meal.id === 'snack')
    expect(snack).toMatchObject({ title: 'Satisfying snack pair' })
    expect(snack.detail).toMatch(/fruit|whole-grain/i)
    expect(plan.evidence.sources).toHaveLength(4)
    expect(plan.evidence.claim).toMatch(/average energy intake/i)
  })

  it('attaches a research rationale to every supported phase without inventing special food rules', () => {
    for (const phase of ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Perimenopause', 'observation']) {
      const evidence = buildTodayFoodPlan(phase, [], 0).evidence
      expect(evidence.sources.length).toBeGreaterThan(0)
      expect(evidence.sources.every(source => source.url.startsWith('https://pubmed.ncbi.nlm.nih.gov/'))).toBe(true)
    }
    expect(buildTodayFoodPlan('Follicular').evidence.claim).toMatch(/no supported special-food rule/i)
    expect(buildTodayFoodPlan('Ovulatory').evidence.claim).toMatch(/no supported special-food rule/i)
  })
})
