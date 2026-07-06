import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const noticeZhTW = {
  title: '通知',
  unreadCount: '（{count} 則未讀）',
  loading: '載入中…',
  noNotices: '暫無新通知',
  fromLabel: '來自 {name}',
  goToChat: '前往聊天回覆',
  sentAttachment: '傳送了附件',
  emptyMessage: '（空白訊息）',
  viewVideo: '查看影片',
  sentImage: '傳送了圖片',
  sentVideo: '傳送了影片',
  sentFile: '傳送了檔案：{name}',
} as const;

export type NoticeMessages = typeof noticeZhTW;

const noticeZhCN: NoticeMessages = {
  title: '通知',
  unreadCount: '（{count} 则未读）',
  loading: '加载中…',
  noNotices: '暂无新通知',
  fromLabel: '来自 {name}',
  goToChat: '前往聊天回复',
  sentAttachment: '传送了附件',
  emptyMessage: '（空白消息）',
  viewVideo: '查看视频',
  sentImage: '传送了图片',
  sentVideo: '传送了视频',
  sentFile: '传送了文件：{name}',
};

const noticeEn: NoticeMessages = {
  title: 'Notifications',
  unreadCount: '({count} unread)',
  loading: 'Loading…',
  noNotices: 'No New Notifications',
  fromLabel: 'From {name}',
  goToChat: 'Reply in Chat',
  sentAttachment: 'Sent an attachment',
  emptyMessage: '(Empty message)',
  viewVideo: 'View Video',
  sentImage: 'Sent an image',
  sentVideo: 'Sent a video',
  sentFile: 'Sent a file: {name}',
};

export const noticeMessages: Record<AppLocale, NoticeMessages> = {
  'zh-TW': noticeZhTW,
  'zh-CN': noticeZhCN,
  en: noticeEn,
};

export function buildNoticeT(locale: AppLocale) {
  const messages = noticeMessages[locale];
  return {
    ...messages,
    format(key: keyof NoticeMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
  };
}
