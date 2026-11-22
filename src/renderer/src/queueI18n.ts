import type { Lang } from './i18n'

/**
 * Copy for queues and bulk selection. Kept separate from the main dictionary
 * so the queue feature can evolve without editing four large locale objects.
 */
export interface QueueCopy {
  section: string
  manage: string
  title: string
  subtitle: string
  add: string
  name: string
  namePlaceholder: string
  moveUp: string
  moveDown: string
  defaultQueue: string
  defaultBadge: string
  defaultForNew: string
  enabled: string
  disabled: string
  schedule: string
  always: string
  window: string
  days: string
  dayNames: string[]
  start: string
  end: string
  overnight: string
  limit: string
  limitHint: string
  unlimited: string
  open: string
  closed: string
  held: string
  remove: string
  removeTitle: string
  removeDesc: string
  removeConfirm: string
  save: string
  saved: string
  allQueues: string
  tasks: string
  defaultNewName: string
  assign: string
  assignTo: string
  pauseAll: string
  select: string
  selectAll: string
  clearSelection: string
  selected: string
  bulkPause: string
  bulkResume: string
  bulkDelete: string
  bulkDeleteTitle: string
  bulkDeleteDesc: string
  deleteFilesToo: string
  pausedCount: string
  resumedCount: string
  movedCount: string
  deletedCount: string
  filterLabel: string
  clearFilter: string
}

export const queueCopy: Record<Lang, QueueCopy> = {
  en: {
    section: 'Queues',
    manage: 'Manage queues',
    title: 'Download queues',
    subtitle: 'Choose when each queue runs and how many downloads it may run at once.',
    add: 'New queue',
    name: 'Queue name',
    namePlaceholder: 'For example, overnight',
    moveUp: 'Move up',
    moveDown: 'Move down',
    defaultQueue: 'Default queue',
    defaultBadge: 'Default',
    defaultForNew: 'Queue for new downloads',
    enabled: 'Enabled',
    disabled: 'Disabled',
    schedule: 'Schedule',
    always: 'Always',
    window: 'Time window',
    days: 'Days',
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    start: 'Start',
    end: 'End',
    overnight: 'When the end time is earlier than the start time, the window continues past midnight.',
    limit: 'Simultaneous downloads',
    limitHint: 'Zero uses the app wide limit.',
    unlimited: 'Unlimited',
    open: 'Open',
    closed: 'Closed',
    held: 'Queue closed',
    remove: 'Remove queue',
    removeTitle: 'Remove this queue?',
    removeDesc: 'Its downloads move to the default queue. No files are deleted.',
    removeConfirm: 'Remove',
    save: 'Save queues',
    saved: 'Queues saved',
    allQueues: 'All queues',
    tasks: 'downloads',
    defaultNewName: 'Queue {count}',
    assign: 'Move to queue',
    assignTo: 'Move to',
    pauseAll: 'Pause all',
    select: 'Select',
    selectAll: 'Select all',
    clearSelection: 'Clear selection',
    selected: '{count} selected',
    bulkPause: 'Pause',
    bulkResume: 'Resume',
    bulkDelete: 'Delete',
    bulkDeleteTitle: 'Delete selected downloads',
    bulkDeleteDesc: '{count} downloads will be removed. This cannot be undone.',
    deleteFilesToo: 'Delete files too',
    pausedCount: 'Paused {count} downloads',
    resumedCount: 'Resumed {count} downloads',
    movedCount: 'Moved {count} downloads',
    deletedCount: 'Deleted {count} downloads',
    filterLabel: 'Queue',
    clearFilter: 'Show all queues'
  },
  fa: {
    section: 'صف‌ها',
    manage: 'مدیریت صف‌ها',
    title: 'صف‌های دانلود',
    subtitle: 'زمان اجرای هر صف و تعداد دانلود هم‌زمان آن را تعیین کنید.',
    add: 'صف جدید',
    name: 'نام صف',
    namePlaceholder: 'برای نمونه، شبانه',
    moveUp: 'بالا بردن',
    moveDown: 'پایین آوردن',
    defaultQueue: 'صف پیش‌فرض',
    defaultBadge: 'پیش‌فرض',
    defaultForNew: 'صف دانلودهای جدید',
    enabled: 'فعال',
    disabled: 'غیرفعال',
    schedule: 'زمان‌بندی',
    always: 'همیشه',
    window: 'بازه زمانی',
    days: 'روزها',
    dayNames: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
    start: 'شروع',
    end: 'پایان',
    overnight: 'اگر زمان پایان پیش از شروع باشد، بازه از نیمه‌شب ادامه پیدا می‌کند.',
    limit: 'دانلود هم‌زمان',
    limitHint: 'صفر یعنی استفاده از محدودیت کلی برنامه.',
    unlimited: 'بدون محدودیت',
    open: 'باز',
    closed: 'بسته',
    held: 'صف بسته است',
    remove: 'حذف صف',
    removeTitle: 'این صف حذف شود؟',
    removeDesc: 'دانلودهای آن به صف پیش‌فرض منتقل می‌شوند. هیچ فایلی حذف نمی‌شود.',
    removeConfirm: 'حذف',
    save: 'ذخیره صف‌ها',
    saved: 'صف‌ها ذخیره شد',
    allQueues: 'همه صف‌ها',
    tasks: 'دانلود',
    defaultNewName: 'صف {count}',
    assign: 'انتقال به صف',
    assignTo: 'انتقال به',
    pauseAll: 'توقف همه',
    select: 'انتخاب',
    selectAll: 'انتخاب همه',
    clearSelection: 'لغو انتخاب',
    selected: '{count} مورد انتخاب شده',
    bulkPause: 'توقف',
    bulkResume: 'ادامه',
    bulkDelete: 'حذف',
    bulkDeleteTitle: 'حذف دانلودهای انتخاب‌شده',
    bulkDeleteDesc: '{count} دانلود حذف خواهد شد. این کار قابل بازگشت نیست.',
    deleteFilesToo: 'فایل‌ها هم حذف شوند',
    pausedCount: '{count} دانلود متوقف شد',
    resumedCount: '{count} دانلود ادامه یافت',
    movedCount: '{count} دانلود منتقل شد',
    deletedCount: '{count} دانلود حذف شد',
    filterLabel: 'صف',
    clearFilter: 'نمایش همه صف‌ها'
  },
  ja: {
    section: 'キュー',
    manage: 'キューの管理',
    title: 'ダウンロードキュー',
    subtitle: '各キューの実行時間帯と同時ダウンロード数を設定します。',
    add: '新しいキュー',
    name: 'キュー名',
    namePlaceholder: '例: 夜間',
    moveUp: '上へ移動',
    moveDown: '下へ移動',
    defaultQueue: '既定のキュー',
    defaultBadge: '既定',
    defaultForNew: '新しいダウンロードの既定キュー',
    enabled: '有効',
    disabled: '無効',
    schedule: 'スケジュール',
    always: '常に',
    window: '時間帯',
    days: '曜日',
    dayNames: ['日', '月', '火', '水', '木', '金', '土'],
    start: '開始',
    end: '終了',
    overnight: '終了時刻が開始時刻より早い場合、時間帯は翌日に続きます。',
    limit: '同時ダウンロード数',
    limitHint: '0 の場合はアプリ全体の制限を使用します。',
    unlimited: '無制限',
    open: '稼働中',
    closed: '停止中',
    held: 'キュー停止中',
    remove: 'キューを削除',
    removeTitle: 'このキューを削除しますか？',
    removeDesc: 'ダウンロードは既定のキューに移動します。ファイルは削除されません。',
    removeConfirm: '削除',
    save: 'キューを保存',
    saved: 'キューを保存しました',
    allQueues: 'すべてのキュー',
    tasks: '件',
    defaultNewName: 'キュー {count}',
    assign: 'キューへ移動',
    assignTo: '移動先',
    pauseAll: 'すべて一時停止',
    select: '選択',
    selectAll: 'すべて選択',
    clearSelection: '選択を解除',
    selected: '{count} 件選択中',
    bulkPause: '一時停止',
    bulkResume: '再開',
    bulkDelete: '削除',
    bulkDeleteTitle: '選択したダウンロードを削除',
    bulkDeleteDesc: '{count} 件のダウンロードを削除します。元に戻せません。',
    deleteFilesToo: 'ファイルも削除',
    pausedCount: '{count} 件を一時停止しました',
    resumedCount: '{count} 件を再開しました',
    movedCount: '{count} 件を移動しました',
    deletedCount: '{count} 件を削除しました',
    filterLabel: 'キュー',
    clearFilter: 'すべてのキューを表示'
  },
  ru: {
    section: 'Очереди',
    manage: 'Управление очередями',
    title: 'Очереди загрузок',
    subtitle: 'Настройте время работы каждой очереди и число одновременных загрузок.',
    add: 'Новая очередь',
    name: 'Название очереди',
    namePlaceholder: 'Например, ночная',
    moveUp: 'Переместить вверх',
    moveDown: 'Переместить вниз',
    defaultQueue: 'Очередь по умолчанию',
    defaultBadge: 'По умолчанию',
    defaultForNew: 'Очередь для новых загрузок',
    enabled: 'Включена',
    disabled: 'Выключена',
    schedule: 'Расписание',
    always: 'Всегда',
    window: 'Интервал',
    days: 'Дни',
    dayNames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    start: 'Начало',
    end: 'Конец',
    overnight: 'Если конец раньше начала, интервал продолжается после полуночи.',
    limit: 'Одновременные загрузки',
    limitHint: 'Ноль означает общий лимит приложения.',
    unlimited: 'Без ограничений',
    open: 'Открыта',
    closed: 'Закрыта',
    held: 'Очередь закрыта',
    remove: 'Удалить очередь',
    removeTitle: 'Удалить эту очередь?',
    removeDesc: 'Ее загрузки перейдут в очередь по умолчанию. Файлы не удаляются.',
    removeConfirm: 'Удалить',
    save: 'Сохранить очереди',
    saved: 'Очереди сохранены',
    allQueues: 'Все очереди',
    tasks: 'загрузок',
    defaultNewName: 'Очередь {count}',
    assign: 'Переместить в очередь',
    assignTo: 'Переместить в',
    pauseAll: 'Приостановить все',
    select: 'Выбрать',
    selectAll: 'Выбрать все',
    clearSelection: 'Снять выбор',
    selected: 'Выбрано: {count}',
    bulkPause: 'Приостановить',
    bulkResume: 'Продолжить',
    bulkDelete: 'Удалить',
    bulkDeleteTitle: 'Удалить выбранные загрузки',
    bulkDeleteDesc: 'Будет удалено загрузок: {count}. Это действие необратимо.',
    deleteFilesToo: 'Удалить файлы',
    pausedCount: 'Приостановлено: {count}',
    resumedCount: 'Возобновлено: {count}',
    movedCount: 'Перемещено: {count}',
    deletedCount: 'Удалено: {count}',
    filterLabel: 'Очередь',
    clearFilter: 'Показать все очереди'
  }
}
