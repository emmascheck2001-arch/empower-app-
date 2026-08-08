import { supabase } from './supabase'
import { clearUserLocalState } from './userLocalState'
import { clearWatchPlan } from './watchBridge'

export async function signOutAndClear(userId) {
  clearUserLocalState(userId)
  await clearWatchPlan()
  await supabase.auth.signOut()
}
