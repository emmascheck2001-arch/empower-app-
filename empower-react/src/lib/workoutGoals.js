import { getUserSetting } from './userSettings'

export const FITNESS_GOALS = [
  { val:'feel_better', icon:'ti-mood-heart', title:'Feel better day to day', sub:'More energy, steadier mood' },
  { val:'strength', icon:'ti-barbell', title:'Build strength & muscle', sub:'Get stronger, feel capable' },
  { val:'consistency', icon:'ti-calendar-check', title:'Move more consistently', sub:'Build the habit, any movement counts' },
  { val:'cycle_health', icon:'ti-heart', title:'Support my cycle & hormones', sub:'Work with your body, not against it' },
  { val:'weight', icon:'ti-flame', title:'Manage my weight healthily', sub:'Sustainable, no crash diets' },
  { val:'destress', icon:'ti-yoga', title:'Reduce stress & feel calmer', sub:'Movement for your mind too' },
]

export function getFitnessGoal(userId) {
  return getUserSetting(userId, 'fitnessGoal')
}
