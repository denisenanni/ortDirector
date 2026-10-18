import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { getReminderHour, listOpenTasks } from './db';
import { buildReminders } from './schedule';

const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Promemoria orto',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

let pending: Promise<void> = Promise.resolve();

/**
 * Rebuilds every scheduled reminder from the current tasks. Cheap enough to
 * call after any change; calls are serialized so they can't interleave.
 */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  pending = pending.then(() => doSync(db)).catch((e) => console.warn('syncReminders', e));
  return pending;
}

async function doSync(db: SQLiteDatabase) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  const [tasks, hour] = await Promise.all([listOpenTasks(db), getReminderHour(db)]);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of buildReminders(tasks, new Date(), hour)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}
