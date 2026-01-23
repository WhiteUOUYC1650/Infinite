export const translations = {
    en: {
      'settings': 'Settings',
      'profile': 'Profile',
      'notifications': 'Notifications',
      'appearance': 'Appearance',
      'language': 'Language',
      'version': 'Version',
      'logout': 'Log out',
      'search': 'Search...',
      'direct_messages': 'Direct Messages',
      'groups': 'Group Discussions',
      'channels': 'Broadcast Channels',
    },
    ru: {
      'settings': 'Настройки',
      'profile': 'Профиль',
      'notifications': 'Уведомления',
      'appearance': 'Внешний вид',
      'language': 'Язык',
      'version': 'Версия',
      'logout': 'Выйти',
      'search': 'Поиск...',
      'direct_messages': 'Личные сообщения',
      'groups': 'Групповые обсуждения',
      'channels': 'Каналы',
    }
  };
  
  export type Language = keyof typeof translations;
  export type TranslationKey = keyof typeof translations['en'];
  