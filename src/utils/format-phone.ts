export const formatPhone = (n: string | number | undefined | null): string => {
  if (n == null) return "";
  return String(n)
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
};
