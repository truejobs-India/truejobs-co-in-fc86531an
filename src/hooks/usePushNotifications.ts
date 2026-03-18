/**
 * Push notifications hook — disabled.
 * Service workers have been fully removed so PushManager is unavailable.
 * This stub prevents import errors in NotificationSettings while returning inert values.
 */
export function usePushNotifications() {
  return {
    isSupported: false,
    permission: 'default' as NotificationPermission,
    isSubscribed: false,
    requestPermission: async () => false,
    subscribe: async () => false,
    unsubscribe: async () => false,
    sendLocalNotification: () => {},
  };
}
