// Cooldown de reenvio de email de confirmação, PERSISTIDO em localStorage.
//
// Por que persistir: o GoTrue limita reenvios ("security purposes, wait Ns").
// Se o cooldown vivesse só em memória, um F5 zeraria o contador e o usuário
// dispararia um resend que falha em silêncio (parece enviado, mas não é).
// Guardando o instante-limite no localStorage, o bloqueio sobrevive a refresh
// e é compartilhado entre o botão de reenviar e a ação de corrigir email.

const KEY = "vb-email-resend-cooldown-until";

/** Marca um cooldown de `seconds` a partir de agora. */
export function setResendCooldown(seconds: number): void {
  try {
    localStorage.setItem(KEY, String(Date.now() + seconds * 1000));
  } catch {
    // localStorage indisponível (modo privado, etc.) — degrada sem quebrar.
  }
}

/** Segundos restantes do cooldown (0 se não houver / já expirou). */
export function getResendCooldownRemaining(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    const remaining = Math.ceil((until - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

/** Limpa o cooldown (ex.: ao confirmar/concluir). */
export function clearResendCooldown(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
