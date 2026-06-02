// 标签中英文映射 — DB 里存英文 id (稳定), UI 显示中文
// 没匹配上的回退到原值

export const CATEGORY_ZH: Record<string, string> = {
  top: "上衣",
  outerwear: "外套",
  bottom: "下装",
  dress: "连衣裙",
  shoes: "鞋",
  bag: "包",
  accessory: "配饰",
  other: "其他",
};

export const SEASON_ZH: Record<string, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  fall: "秋",
  winter: "冬",
};

export const COLOR_ZH: Record<string, string> = {
  white: "白色",
  black: "黑色",
  grey: "灰色",
  gray: "灰色",
  silver: "银色",
  red: "红色",
  pink: "粉色",
  orange: "橙色",
  yellow: "黄色",
  brown: "棕色",
  beige: "米色",
  khaki: "卡其色",
  tan: "驼色",
  green: "绿色",
  olive: "橄榄绿",
  mint: "薄荷绿",
  teal: "青色",
  cyan: "青色",
  blue: "蓝色",
  navy: "藏青",
  purple: "紫色",
  violet: "紫罗兰",
  gold: "金色",
  multicolor: "多彩",
};

export const MATERIAL_ZH: Record<string, string> = {
  cotton: "棉",
  linen: "麻",
  silk: "真丝",
  wool: "羊毛",
  cashmere: "羊绒",
  polyester: "聚酯纤维",
  nylon: "尼龙",
  denim: "牛仔",
  leather: "皮革",
  suede: "麂皮",
  fleece: "摇粒绒",
  knit: "针织",
  chiffon: "雪纺",
  satin: "缎面",
  velvet: "丝绒",
  "cotton blend": "混纺棉",
  "polyester blend": "混纺",
};

export const STYLE_ZH: Record<string, string> = {
  casual: "休闲",
  formal: "正式",
  business: "商务",
  sporty: "运动",
  athletic: "运动",
  vintage: "复古",
  retro: "复古",
  streetwear: "街头",
  street: "街头",
  bohemian: "波西米亚",
  boho: "波西米亚",
  minimalist: "极简",
  minimal: "极简",
  preppy: "学院",
  punk: "朋克",
  gothic: "暗黑",
  jk: "JK 制服",
  hanfu: "汉服",
  lolita: "洛丽塔",
  elegant: "优雅",
  chic: "时尚",
  edgy: "前卫",
  cute: "可爱",
  romantic: "浪漫",
  classic: "经典",
};

function lookup(table: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "";
  return table[value.toLowerCase().trim()] ?? value;
}

export const zhCategory = (v: string | null | undefined) => lookup(CATEGORY_ZH, v);
export const zhSeason = (v: string | null | undefined) => lookup(SEASON_ZH, v);
export const zhColor = (v: string | null | undefined) => lookup(COLOR_ZH, v);
export const zhMaterial = (v: string | null | undefined) => lookup(MATERIAL_ZH, v);
export const zhStyle = (v: string | null | undefined) => lookup(STYLE_ZH, v);
