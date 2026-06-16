export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(digits[i], 10) * (10 - i);
  }

  let firstCheckDigit = 11 - (sum % 11);
  if (firstCheckDigit >= 10) firstCheckDigit = 0;
  if (firstCheckDigit !== Number.parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(digits[i], 10) * (11 - i);
  }

  let secondCheckDigit = 11 - (sum % 11);
  if (secondCheckDigit >= 10) secondCheckDigit = 0;

  return secondCheckDigit === Number.parseInt(digits[10], 10);
}

export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateCheckDigit = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number.parseInt(digits[i], 10) * weights[i];
    }

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (calculateCheckDigit(12) !== Number.parseInt(digits[12], 10)) {
    return false;
  }

  return calculateCheckDigit(13) === Number.parseInt(digits[13], 10);
}

export function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);

  return false;
}
