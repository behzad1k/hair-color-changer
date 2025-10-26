import en from '@/lang/en';
import fa from '@/lang/fa';
import { Dictionary } from '@/utils/types';

const rtlLanguages = ['fa']

const dictionaries: Dictionary = {
  fa,
  en
}

export const language = process.env.NEXT_PUBLIC_APP_LANGUAGE || 'en'

export const isRTL = rtlLanguages.includes(language)

const dih = dictionaries[language]

export default dih