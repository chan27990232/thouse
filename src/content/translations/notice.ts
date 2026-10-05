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
  kindViewing: '預約睇樓',
  kindViewingSuccess: '預約成功',
  kindViewingIgnored: '預約未獲接納',
  kindLeaseOffer: '可簽約',
  kindLeaseSubmitted: '簽約申請',
  kindLeaseLandlordAccepted: '業主已同意簽約',
  kindLeaseRejected: '簽約申請未獲接納',
  kindMessage: '訊息',
  bodyViewing: '租客已送出睇樓預約，請到聊天室確認。',
  bodyViewingSuccess: '業主已接受睇樓預約。',
  bodyViewingIgnored: '業主未能接受此次睇樓預約。',
  bodyLeaseOffer: '業主已上傳租約，可繼續簽約。',
  bodyLeaseSubmitted: '租客已提交簽約申請。',
  bodyLeaseLandlordAccepted: '業主已同意簽約申請，等待平台複審。',
  bodyLeaseRejected: '簽約申請未獲接納。',
  goToView: '前往查看',
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
  kindViewing: '预约睇楼',
  kindViewingSuccess: '预约成功',
  kindViewingIgnored: '预约未获接纳',
  kindLeaseOffer: '可签约',
  kindLeaseSubmitted: '签约申请',
  kindLeaseLandlordAccepted: '业主已同意签约',
  kindLeaseRejected: '签约申请未获接纳',
  kindMessage: '消息',
  bodyViewing: '租客已送出睇楼预约，请到聊天室确认。',
  bodyViewingSuccess: '业主已接受睇楼预约。',
  bodyViewingIgnored: '业主未能接受此次睇楼预约。',
  bodyLeaseOffer: '业主已上传租约，可继续签约。',
  bodyLeaseSubmitted: '租客已提交签约申请。',
  bodyLeaseLandlordAccepted: '业主已同意签约申请，等待平台复审。',
  bodyLeaseRejected: '签约申请未获接纳。',
  goToView: '前往查看',
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
  kindViewing: 'Viewing request',
  kindViewingSuccess: 'Viewing confirmed',
  kindViewingIgnored: 'Viewing declined',
  kindLeaseOffer: 'Ready to sign',
  kindLeaseSubmitted: 'Lease application',
  kindLeaseLandlordAccepted: 'Landlord accepted',
  kindLeaseRejected: 'Application declined',
  kindMessage: 'Message',
  bodyViewing: 'A tenant requested a viewing. Confirm it in chat.',
  bodyViewingSuccess: 'The landlord accepted the viewing booking.',
  bodyViewingIgnored: 'The landlord could not accept this viewing.',
  bodyLeaseOffer: 'The landlord uploaded a lease. You can continue to apply.',
  bodyLeaseSubmitted: 'The tenant submitted a lease application.',
  bodyLeaseLandlordAccepted: 'The landlord accepted the application. Platform review is next.',
  bodyLeaseRejected: 'The lease application was not accepted.',
  goToView: 'View',
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
