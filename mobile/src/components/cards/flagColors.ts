import type { Continent } from '@/types/card';

/**
 * Dominant flag colors per ISO 3166-1 alpha-2 code, ordered by visual weight.
 * Only colors are used: no emblem, coat of arms or symbol is ever drawn.
 */
const FLAG_COLORS: Record<string, readonly string[]> = {
  AE: ['#00732F', '#FFFFFF', '#000000', '#FF0000'],
  AF: ['#000000', '#D32011', '#007A36'],
  AL: ['#E41E20', '#000000'],
  AM: ['#D90012', '#0033A0', '#F2A800'],
  AO: ['#CC092F', '#000000', '#FFCB00'],
  AR: ['#74ACDF', '#FFFFFF', '#F6B40E'],
  AT: ['#ED2939', '#FFFFFF'],
  AU: ['#012169', '#FFFFFF', '#E4002B'],
  AZ: ['#00B5E2', '#EF3340', '#509E2F'],
  BA: ['#002395', '#FECB00', '#FFFFFF'],
  BD: ['#006A4E', '#F42A41'],
  BE: ['#000000', '#FDDA24', '#EF3340'],
  BF: ['#EF2B2D', '#009E49', '#FCD116'],
  BG: ['#FFFFFF', '#00966E', '#D62612'],
  BI: ['#CE1126', '#1EB53A', '#FFFFFF'],
  BJ: ['#008751', '#FCD116', '#E8112D'],
  BN: ['#F7E017', '#FFFFFF', '#000000'],
  BO: ['#D52B1E', '#F9E300', '#007934'],
  BR: ['#009C3B', '#FFDF00', '#002776'],
  BS: ['#00778B', '#FFC72C', '#000000'],
  BW: ['#75AADB', '#FFFFFF', '#000000'],
  BY: ['#C8313E', '#4AA657', '#FFFFFF'],
  CA: ['#FF0000', '#FFFFFF'],
  CD: ['#007FFF', '#CE1021', '#F7D618'],
  CF: ['#003082', '#289728', '#FFCE00', '#D21034'],
  CG: ['#009543', '#FBDE4A', '#DC241F'],
  CH: ['#DA291C', '#FFFFFF'],
  CI: ['#F77F00', '#FFFFFF', '#009E60'],
  CL: ['#0039A6', '#FFFFFF', '#D52B1E'],
  CM: ['#007A5E', '#CE1126', '#FCD116'],
  CN: ['#EE1C25', '#FFFF00'],
  CO: ['#FCD116', '#003893', '#CE1126'],
  CR: ['#002B7F', '#FFFFFF', '#CE1126'],
  CU: ['#002A8F', '#FFFFFF', '#CF142B'],
  CY: ['#FFFFFF', '#D57800', '#4E5B31'],
  CZ: ['#FFFFFF', '#D7141A', '#11457E'],
  DE: ['#000000', '#DD0000', '#FFCE00'],
  DJ: ['#6AB2E7', '#12AD2B', '#FFFFFF'],
  DK: ['#C8102E', '#FFFFFF'],
  DO: ['#002D62', '#CE1126', '#FFFFFF'],
  DZ: ['#006233', '#FFFFFF', '#D21034'],
  EC: ['#FFDD00', '#034EA2', '#ED1C24'],
  EE: ['#0072CE', '#000000', '#FFFFFF'],
  EG: ['#CE1126', '#FFFFFF', '#000000', '#C09300'],
  ER: ['#12AD2B', '#4189DD', '#EA0437'],
  ES: ['#AA151B', '#F1BF00'],
  ET: ['#078930', '#FCDD09', '#DA121A', '#0F47AF'],
  FI: ['#FFFFFF', '#002F6C'],
  FJ: ['#68BFE5', '#012169', '#CE1126'],
  FR: ['#002395', '#FFFFFF', '#ED2939'],
  GA: ['#009E60', '#FCD116', '#3A75C4'],
  GB: ['#012169', '#FFFFFF', '#C8102E'],
  GE: ['#FFFFFF', '#FF0000'],
  GH: ['#CE1126', '#FCD116', '#006B3F', '#000000'],
  GM: ['#CE1126', '#0C1C8C', '#3A7728'],
  GN: ['#CE1126', '#FCD116', '#009460'],
  GQ: ['#3E9A00', '#FFFFFF', '#E32118', '#0073CE'],
  GR: ['#0D5EAF', '#FFFFFF'],
  GT: ['#4997D0', '#FFFFFF'],
  GW: ['#CE1126', '#FCD116', '#009E49', '#000000'],
  GY: ['#009E49', '#FCD116', '#CE1126', '#000000'],
  HN: ['#0073CF', '#FFFFFF'],
  HR: ['#FF0000', '#FFFFFF', '#171796'],
  HT: ['#00209F', '#D21034'],
  HU: ['#CE2939', '#FFFFFF', '#477050'],
  ID: ['#FF0000', '#FFFFFF'],
  IE: ['#169B62', '#FFFFFF', '#FF883E'],
  IL: ['#FFFFFF', '#0038B8'],
  IN: ['#FF9933', '#FFFFFF', '#138808', '#000080'],
  IQ: ['#CE1126', '#FFFFFF', '#000000', '#007A3D'],
  IR: ['#239F40', '#FFFFFF', '#DA0000'],
  IS: ['#02529C', '#FFFFFF', '#DC1E35'],
  IT: ['#009246', '#FFFFFF', '#CE2B37'],
  JM: ['#009B3A', '#FED100', '#000000'],
  JO: ['#000000', '#FFFFFF', '#007A3D', '#CE1126'],
  JP: ['#FFFFFF', '#BC002D'],
  KE: ['#000000', '#BB0000', '#006600', '#FFFFFF'],
  KG: ['#E8112D', '#FFEF00'],
  KH: ['#032EA1', '#E00025', '#FFFFFF'],
  KP: ['#024FA2', '#ED1C27', '#FFFFFF'],
  KR: ['#FFFFFF', '#CD2E3A', '#0047A0', '#000000'],
  KW: ['#007A3D', '#FFFFFF', '#CE1126', '#000000'],
  KZ: ['#00AFCA', '#FEC50C'],
  LA: ['#CE1126', '#002868', '#FFFFFF'],
  LB: ['#ED1C24', '#FFFFFF', '#00A651'],
  LK: ['#8D153A', '#FFBE29', '#00534E', '#EB7400'],
  LR: ['#BF0A30', '#FFFFFF', '#002868'],
  LS: ['#00209F', '#FFFFFF', '#009543'],
  LT: ['#FDB913', '#006A44', '#C1272D'],
  LV: ['#9E3039', '#FFFFFF'],
  LY: ['#E70013', '#000000', '#239E46'],
  MA: ['#C1272D', '#006233'],
  MD: ['#0046AE', '#FFD200', '#CC092F'],
  ME: ['#C40308', '#D3AE3B'],
  MG: ['#FFFFFF', '#FC3D32', '#007E3A'],
  MK: ['#D20000', '#FFE600'],
  ML: ['#14B53A', '#FCD116', '#CE1126'],
  MM: ['#FECB00', '#34B233', '#EA2839', '#FFFFFF'],
  MN: ['#C4272F', '#015197', '#F9CF02'],
  MR: ['#006233', '#FFC400', '#D01C1F'],
  MW: ['#000000', '#CE1126', '#339E35'],
  MX: ['#006847', '#FFFFFF', '#CE1126'],
  MY: ['#CC0001', '#FFFFFF', '#010066', '#FFCC00'],
  MZ: ['#009A44', '#000000', '#FCE100', '#D21034'],
  NA: ['#003580', '#D21034', '#009543'],
  NE: ['#E05206', '#FFFFFF', '#0DB02B'],
  NG: ['#008751', '#FFFFFF'],
  NI: ['#0067C6', '#FFFFFF'],
  NL: ['#AE1C28', '#FFFFFF', '#21468B'],
  NO: ['#BA0C2F', '#FFFFFF', '#00205B'],
  NP: ['#DC143C', '#003893', '#FFFFFF'],
  NZ: ['#012169', '#FFFFFF', '#C8102E'],
  OM: ['#DB161B', '#FFFFFF', '#008000'],
  PA: ['#FFFFFF', '#DA121A', '#072357'],
  PE: ['#D91023', '#FFFFFF'],
  PG: ['#000000', '#CE1126', '#FCD116'],
  PH: ['#0038A8', '#CE1126', '#FFFFFF', '#FCD116'],
  PK: ['#01411C', '#FFFFFF'],
  PL: ['#FFFFFF', '#DC143C'],
  PR: ['#ED0000', '#FFFFFF', '#0050F0'],
  PS: ['#000000', '#FFFFFF', '#007A3D', '#CE1126'],
  PT: ['#006600', '#FF0000', '#FFCC00'],
  PY: ['#D52B1E', '#FFFFFF', '#0038A8'],
  QA: ['#8A1538', '#FFFFFF'],
  RO: ['#002B7F', '#FCD116', '#CE1126'],
  RS: ['#C6363C', '#0C4076', '#FFFFFF'],
  RU: ['#FFFFFF', '#0039A6', '#D52B1E'],
  RW: ['#00A1DE', '#FAD201', '#20603D'],
  SA: ['#006C35', '#FFFFFF'],
  SD: ['#D21034', '#FFFFFF', '#000000', '#007229'],
  SE: ['#006AA7', '#FECC00'],
  SG: ['#EF3340', '#FFFFFF'],
  SI: ['#FFFFFF', '#005DA4', '#ED1C24'],
  SK: ['#FFFFFF', '#0B4EA2', '#EE1C25'],
  SL: ['#1EB53A', '#FFFFFF', '#0072C6'],
  SN: ['#00853F', '#FDEF42', '#E31B23'],
  SO: ['#4189DD', '#FFFFFF'],
  SR: ['#377E3F', '#FFFFFF', '#B40A2D', '#ECC81D'],
  SS: ['#000000', '#DA121A', '#078930', '#0F47AF'],
  SV: ['#0F47AF', '#FFFFFF'],
  SY: ['#CE1126', '#FFFFFF', '#000000', '#007A3D'],
  SZ: ['#3E5EB9', '#FFD900', '#B10C0C'],
  TD: ['#002664', '#FECB00', '#C60C30'],
  TG: ['#006A4E', '#FFCE00', '#D21034'],
  TH: ['#A51931', '#F4F5F8', '#2D2A4A'],
  TJ: ['#CC0000', '#FFFFFF', '#006600'],
  TL: ['#DC241F', '#FFC726', '#000000'],
  TM: ['#00843D', '#D22630', '#FFFFFF'],
  TN: ['#E70013', '#FFFFFF'],
  TO: ['#C10000', '#FFFFFF'],
  TR: ['#E30A17', '#FFFFFF'],
  TT: ['#CE1126', '#000000', '#FFFFFF'],
  TW: ['#FE0000', '#000095', '#FFFFFF'],
  TZ: ['#1EB53A', '#FCD116', '#000000', '#00A3DD'],
  UA: ['#0057B7', '#FFD700'],
  UG: ['#000000', '#FCDC04', '#D90000'],
  US: ['#B22234', '#FFFFFF', '#3C3B6E'],
  UY: ['#FFFFFF', '#0038A8', '#FCD116'],
  UZ: ['#1EB53A', '#FFFFFF', '#0099B5', '#CE1126'],
  VA: ['#FFE000', '#FFFFFF'],
  VE: ['#FFCC00', '#00247D', '#CF142B'],
  VN: ['#DA251D', '#FFFF00'],
  WS: ['#CE1126', '#002B7F', '#FFFFFF'],
  YE: ['#CE1126', '#FFFFFF', '#000000'],
  ZA: ['#007A4D', '#FFB612', '#DE3831', '#002395', '#000000'],
  ZM: ['#198A00', '#DE2010', '#000000', '#EF7D00'],
  ZW: ['#319208', '#FFD200', '#DE2010', '#000000'],
};

/** Used when a country is missing from the table, so every card still gets a palette. */
const CONTINENT_FALLBACK: Record<Continent, readonly [string, string]> = {
  africa: ['#C8742E', '#2E6B3F'],
  asia: ['#B8323A', '#D9A93B'],
  europe: ['#2F4E8C', '#C9CED6'],
  north_america: ['#2B4A7E', '#B03A3A'],
  south_america: ['#2E8A4F', '#E2C044'],
  oceania: ['#1F6E8C', '#E6E1D3'],
};

export type FlagPalette = {
  /** Two colors for the artwork gradient, picked to keep contrast with white text. */
  primary: string;
  secondary: string;
  /** Every flag color, for the small flag chip. */
  stripes: readonly string[];
};

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/**
 * Picks the artwork colors of a country. White and very light colors are skipped for the
 * gradient (they would wash out the white card text) but kept in the flag chip stripes.
 */
export function flagPalette(country: string, continent: Continent): FlagPalette {
  const stripes = FLAG_COLORS[country.toUpperCase()];
  if (!stripes) {
    const [primary, secondary] = CONTINENT_FALLBACK[continent];
    return { primary, secondary, stripes: [primary, secondary] };
  }
  const saturated = stripes.filter((color) => luminance(color) < 0.7);
  const [fallbackPrimary, fallbackSecondary] = CONTINENT_FALLBACK[continent];
  const primary = saturated[0] ?? fallbackPrimary;
  const secondary = saturated.find((color) => color !== primary) ?? fallbackSecondary;
  return { primary, secondary, stripes };
}

export function hasFlagColors(country: string): boolean {
  return country.toUpperCase() in FLAG_COLORS;
}
