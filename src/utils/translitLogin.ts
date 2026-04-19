const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

/** Латиница [a-z0-9], без пробелов и прочих символов */
export function translitToLatinCompact(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '')
  }
  return out.replace(/[^a-z0-9]/g, '')
}

/** Логин курьера: фамилия + имя, транслит, без пробелов */
export function courierLoginFromNames(lastName: string, firstName: string): string {
  return `${translitToLatinCompact(lastName)}${translitToLatinCompact(firstName)}`
}
