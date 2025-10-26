
export type Color = {
  category?: string,
  title: string,
  color: string,
  lightVariant: string,
  darkVariant: string
}
export type HighlightColor = {
  title: string,
  color: string,
}

export type ColorCategory = {
  slug?: string,
  title: string,
  color: string,
  lightVariant: string,
  darkVariant: string
}

export type Dictionary = Record<string, Record<string, string>>