const ONES = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
];

const TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underHundred(value: bigint): string {
  if (value < 10n) return ONES[Number(value)];
  if (value < 20n) return TEENS[Number(value - 10n)];
  if (value < 100n) {
    const tens = Number(value / 10n);
    const ones = Number(value % 10n);
    return ones === 0 ? TENS[tens - 2] : `${TENS[tens - 2]} ${ONES[ones]}`;
  }

  return '';
}

function underThousand(value: bigint): string {
  if (value < 100n) return underHundred(value);

  const hundreds = value / 100n;
  const remainder = value % 100n;
  const hundredsText = convertToWords(hundreds);

  if (remainder === 0n) {
    return `${hundredsText} Hundred`;
  }

  return `${hundredsText} Hundred ${underHundred(remainder)}`;
}

function underCrore(value: bigint): string {
  if (value < 1000n) return underThousand(value);

  const lakh = value / 100000n;
  const remainder = value % 100000n;

  if (lakh > 0n && remainder === 0n) {
    return `${underThousand(lakh)} Lakh`;
  }

  if (lakh > 0n) {
    return `${underThousand(lakh)} Lakh ${underThousand(remainder)}`;
  }

  return underThousand(remainder);
}

function convertToWords(value: bigint): string {
  if (value === 0n) return 'Zero';

  const crore = value / 10000000n;
  const remainder = value % 10000000n;

  if (crore > 0n && remainder === 0n) {
    return `${underThousand(crore)} Crore`;
  }

  if (crore > 0n) {
    return `${underThousand(crore)} Crore ${underCrore(remainder)}`;
  }

  return underCrore(value);
}

export function amountToWords(value: number | string): string {
  const raw = String(value).trim();
  const sanitized = raw.replace(/,/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(sanitized)) {
    return 'Rupees Zero Only';
  }

  const [wholePart = '0', fractionPart = ''] = sanitized.split('.');
  const wholeValue = BigInt(wholePart.replace('-', '') || '0');
  const paiseValue = fractionPart ? BigInt((fractionPart + '00').slice(0, 2)) : 0n;

  const rupeesWords = convertToWords(wholeValue);

  if (paiseValue > 0n) {
    return `Rupees ${rupeesWords} and ${convertToWords(paiseValue)} Paise Only`;
  }

  return `Rupees ${rupeesWords} Only`;
}
