import dih from '@/lang/dictionary';
import { Color, ColorCategory, HighlightColor } from '@/utils/types'; // adjust path as needed

export const COLOR_CATEGORIES: ColorCategory[] = [
  {
    slug: 'red',
    title: dih.categoryRed,
    color: '#6f3140',
    lightVariant: '#4a2342',
    darkVariant: '#150a13'
  },
  {
    slug: 'brown',
    title: dih.categoryBrown,
    color: '#2d2823',
    lightVariant: '#5a5046',
    darkVariant: '#1d1a16'
  },
  {
    slug: 'natural',
    title: dih.categoryNatural,
    color: '#28282e',
    lightVariant: '#2a2a2a',
    darkVariant: '#000000'
  },
  {
    slug: 'quartz',
    title: dih.categoryQuartz,
    color: '#281c1e',
    lightVariant: '#50383c',
    darkVariant: '#1a1214'
  },
  {
    slug: 'variation',
    title: dih.categoryVariation,
    color: '#a3a2a8',
    lightVariant: '#d3d2d8',
    darkVariant: '#73727a'
  },
];

export const COLOR_PALETTE: Color[] = [
  {
    category: 'red',
    title: dih.colorDarkWine,
    color: '#231121',
    lightVariant: '#4a2342',
    darkVariant: '#150a13'
  },
  {
    category: 'red',
    title: dih.colorWine,
    color: '#2c1c27',
    lightVariant: '#583848',
    darkVariant: '#1c0e19'
  },
  {
    category: 'red',
    title: dih.colorLightWine,
    color: '#3c1e3c',
    lightVariant: '#6e3c6e',
    darkVariant: '#2a122a'
  },
  {
    category: 'red',
    title: dih.colorCherryRed,
    color: '#6f3140',
    lightVariant: '#9e4660',
    darkVariant: '#4a1f2b'
  },
  {
    category: 'red',
    title: dih.colorLightCherryRed,
    color: '#7c4650',
    lightVariant: '#b26878',
    darkVariant: '#562f38'
  },
  {
    category: 'red',
    title: dih.colorFireRed,
    color: '#42050b',
    lightVariant: '#8a0a16',
    darkVariant: '#2a0307'
  },
  {
    category: 'red',
    title: dih.colorLightFireRed,
    color: '#50141e',
    lightVariant: '#a0283c',
    darkVariant: '#350d14'
  },
  {
    category: 'brown',
    title: dih.colorDarkChocolate,
    color: '#2d2823',
    lightVariant: '#5a5046',
    darkVariant: '#1d1a16'
  },
  {
    category: 'brown',
    title: dih.colorNutella,
    color: '#5a463f',
    lightVariant: '#8c6e5f',
    darkVariant: '#3d2f2a'
  },
  {
    category: 'brown',
    title: dih.colorCafeLatte,
    color: '#a6826f',
    lightVariant: '#d4b29f',
    darkVariant: '#7a5e4f'
  },
  {
    category: 'brown',
    title: dih.colorMocha,
    color: '#463225',
    lightVariant: '#6e4e3a',
    darkVariant: '#2e2118'
  },
  {
    category: 'brown',
    title: dih.colorIceMocha,
    color: '#b9a07d',
    lightVariant: '#e5ccad',
    darkVariant: '#8a7559'
  },
  {
    category: 'brown',
    title: dih.colorHotChocolate,
    color: '#321e14',
    lightVariant: '#643c28',
    darkVariant: '#21130d'
  },
  {
    category: 'brown',
    title: dih.colorMink,
    color: '#644b41',
    lightVariant: '#967161',
    darkVariant: '#44322b'
  },
  {
    category: 'brown',
    title: dih.colorWhiteChocolate,
    color: '#debeaa',
    lightVariant: '#f5e5d5',
    darkVariant: '#b59e8a'
  },
  {
    category: 'natural',
    title: dih.colorBlack,
    color: '#000000',
    lightVariant: '#2a2a2a',
    darkVariant: '#000000'
  },
  {
    category: 'natural',
    title: dih.colorDarkBrown,
    color: '#28282e',
    lightVariant: '#50505c',
    darkVariant: '#1a1a1e'
  },
  {
    category: 'natural',
    title: dih.colorVeryDarkBrown,
    color: '#0d0a15',
    lightVariant: '#1a142a',
    darkVariant: '#05030a'
  },
  {
    category: 'natural',
    title: dih.colorBrown,
    color: '#463a38',
    lightVariant: '#6e5e5c',
    darkVariant: '#2e2624'
  },
  {
    category: 'natural',
    title: dih.colorLightBrown,
    color: '#493c3c',
    lightVariant: '#735e5e',
    darkVariant: '#312828'
  },
  {
    category: 'natural',
    title: dih.colorDarkBlonde,
    color: '#4f3b32',
    lightVariant: '#7a5b4c',
    darkVariant: '#352721'
  },
  {
    category: 'natural',
    title: dih.colorBlonde,
    color: '#644632',
    lightVariant: '#966a4c',
    darkVariant: '#442f21'
  },
  {
    category: 'natural',
    title: dih.colorLightBlonde,
    color: '#7d583b',
    lightVariant: '#bc8459',
    darkVariant: '#563c28'
  },
  {
    category: 'natural',
    title: dih.colorVeryLightBlonde,
    color: '#86643a',
    lightVariant: '#c89658',
    darkVariant: '#5e4528'
  },
  {
    category: 'natural',
    title: dih.colorExtraLightBlonde,
    color: '#d8be91',
    lightVariant: '#f5e5c9',
    darkVariant: '#b39e73'
  },
  {
    category: 'quartz',
    title: dih.colorSmokyQuartz,
    color: '#281c1e',
    lightVariant: '#50383c',
    darkVariant: '#1a1214'
  },
  {
    category: 'quartz',
    title: dih.colorLightSmokyQuartz,
    color: '#867072',
    lightVariant: '#b6a0a2',
    darkVariant: '#5e4e50'
  },
  {
    category: 'quartz',
    title: dih.colorVeryLightSmokyQuartz,
    color: '#b09793',
    lightVariant: '#d8c7c3',
    darkVariant: '#886f6b'
  },
  {
    category: 'quartz',
    title: dih.colorRoseQuartz,
    color: '#b68e8e',
    lightVariant: '#d8b6b6',
    darkVariant: '#8e6666'
  },
  {
    category: 'quartz',
    title: dih.colorLightRoseQuartz,
    color: '#c6a0a0',
    lightVariant: '#e6c8c8',
    darkVariant: '#9e7878'
  },
  {
    category: 'variation',
    title: dih.colorSilverVariation,
    color: '#a3a2a8',
    lightVariant: '#d3d2d8',
    darkVariant: '#73727a'
  },
  {
    category: 'variation',
    title: dih.colorGreenVariation,
    color: '#3c5055',
    lightVariant: '#5c7880',
    darkVariant: '#28383b'
  },
];

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  {
    color: '#F5F5DC',
    title: dih.highlightPlatinum
  },
  {
    color: '#E6D3A3',
    title: dih.highlightChampagne
  },
  {
    color: '#DEB887',
    title: dih.highlightHoney
  },
  {
    color: '#D2B48C',
    title: dih.highlightCaramel
  },
  {
    color: '#F0E68C',
    title: dih.highlightLightGold
  },
  {
    color: '#FFEFD5',
    title: dih.highlightCream
  },
  {
    color: '#FFE4B5',
    title: dih.highlightMoccasin
  },
  {
    color: '#E6E6FA',
    title: dih.highlightLavender
  }
];