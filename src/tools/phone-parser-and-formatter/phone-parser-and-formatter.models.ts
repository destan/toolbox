import type { CountryCode, NumberType } from 'libphonenumber-js';
import lookup from 'country-code-lookup';

export { formatTypeToHumanReadable, getCountryFlag, getDefaultCountryCode, getFullCountryName };

const typeToLabel: Record<NonNullable<NumberType>, string> = {
  MOBILE: 'Mobile',
  FIXED_LINE: 'Fixed line',
  FIXED_LINE_OR_MOBILE: 'Fixed line or mobile',
  PERSONAL_NUMBER: 'Personal number',
  PREMIUM_RATE: 'Premium rate',
  SHARED_COST: 'Shared cost',
  TOLL_FREE: 'Toll free',
  UAN: 'Universal access number',
  VOICEMAIL: 'Voicemail',
  VOIP: 'VoIP',
  PAGER: 'Pager',
};

function formatTypeToHumanReadable(type: NumberType): string | undefined {
  if (!type) {
    return undefined;
  }

  return typeToLabel[type];
}

function getFullCountryName(countryCode: string | undefined) {
  if (!countryCode) {
    return undefined;
  }

  return lookup.byIso(countryCode)?.country;
}

const REGIONAL_INDICATOR_OFFSET = 0x1F1E6 - 'A'.charCodeAt(0);

function getCountryFlag(countryCode: string | undefined) {
  if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) {
    return undefined;
  }

  return [...countryCode.toUpperCase()]
    .map(letter => String.fromCodePoint(letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET))
    .join('');
}

function getDefaultCountryCode({
  locale = window.navigator.language,
  defaultCode = 'FR',
}: { locale?: string; defaultCode?: CountryCode } = {}): CountryCode {
  const countryCode = locale.split('-')[1]?.toUpperCase();

  if (!countryCode) {
    return defaultCode;
  }

  return (lookup.byIso(countryCode)?.iso2 ?? defaultCode) as CountryCode;
}
