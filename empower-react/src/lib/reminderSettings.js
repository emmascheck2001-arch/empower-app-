import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE } from './notifications'
import { getUserLocal } from './userLocalState'

function readPrefs(userId) {
  const hour = Number(getUserLocal(userId, 'notifyHour'))
  const minute = Number(getUserLocal(userId, 'notifyMinute'))
  return {
    enabled: getUserLocal(userId, 'notifyEnabled') === '1',
    hour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_REMINDER_HOUR,
    minute: Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_REMINDER_MINUTE,
  }
}

export function notificationPrefs(userId) {
  return readPrefs(userId)
}
