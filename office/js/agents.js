/** 夜貓總部 bot 名冊：每個都係唔同品種嘅貓 */
export const STATUS = {
  thinking: { id: 'thinking', label: '諗緊', color: '#e8c547' },
  running:  { id: 'running',  label: '開工', color: '#3b8ee0' },
  waiting:  { id: 'waiting',  label: '要你', color: '#e09412' },
  done:     { id: 'done',     label: '完成', color: '#22a874' },
  idle:     { id: 'idle',     label: '收工', color: '#6b7280' },
};

export const AGENTS = [
  {
    id: 'ha',
    name: '蝦主管',
    breed: '三花／玳瑁混',
    breedKey: 'calico',
    role: '跨項目',
    color: '#f0a070',
  },
  {
    id: 'aim',
    name: 'AI manager',
    breed: '英國短毛貓',
    breedKey: 'britishShorthair',
    role: '總部統籌',
    color: '#8aa0b8',
  },
  {
    id: 'nemo',
    name: '投資主管',
    breed: '緬因貓',
    breedKey: 'maineCoon',
    role: 'NEMO 協調',
    color: '#b07a45',
  },
  {
    id: 'pre',
    name: 'Premarket Desk',
    breed: '暹羅貓',
    breedKey: 'siamese',
    role: '盤前早報',
    color: '#d8c4a0',
  },
  {
    id: 'news',
    name: '即時資訊',
    breed: '阿比西尼亞',
    breedKey: 'abyssinian',
    role: '市況催化',
    color: '#c07840',
  },
  {
    id: 'fund',
    name: '基本分析',
    breed: '俄羅斯藍貓',
    breedKey: 'russianBlue',
    role: '基本面',
    color: '#7a8fa8',
  },
  {
    id: 'ta',
    name: '技術分析',
    breed: '孟加拉貓',
    breedKey: 'bengal',
    role: '圖表',
    color: '#d4a04a',
  },
  {
    id: 'entry',
    name: '入市建議',
    breed: '蘇格蘭摺耳',
    breedKey: 'scottishFold',
    role: '綜合建議',
    color: '#9aa0a8',
  },
  {
    id: 'prawn',
    name: '釣蝦高手',
    breed: '橘貓',
    breedKey: 'orangeTabby',
    role: '產品線',
    color: '#e8913a',
  },
  {
    id: 'other',
    name: '異度空間',
    breed: '黑貓',
    breedKey: 'black',
    role: '預留',
    color: '#2a2a2e',
  },
];

export const STATUS_MESSAGES = {
  thinking: [
    '梳理 overnight 線索…',
    '對齊跨 bot 優先序…',
    '評估風險同報酬…',
    '諗緊下一個動作…',
  ],
  running: [
    '拉緊盤前數據',
    '更新圖表層',
    '掃市況催化劑',
    '寫緊建議草稿',
    '整理 NEMO 狀態',
  ],
  waiting: [
    '等你確認方向',
    '需要你拍板',
    '卡住——想問你一句',
    '等批准先繼續',
  ],
  done: [
    '本輪收工，報告已出',
    '交付完成，休息陣',
    '任務清乾淨',
  ],
  idle: [
    '喺 lounge 伸懶腰',
    '去茶水間睇風景',
    '趴喺主管室窗外發呆',
    '空檔，等下一輪',
  ],
};

export function pickMessage(status) {
  const list = STATUS_MESSAGES[status] || STATUS_MESSAGES.idle;
  return list[Math.floor(Math.random() * list.length)];
}
