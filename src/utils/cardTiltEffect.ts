/**
 * Эффект 3d поворот карточек — сохранён для будущего использования.
 * Сейчас этот модуль нигде не импортируется, поэтому эффект отключён.
 */
export function initCardTiltEffect() {
  if (
    !matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    ).matches
  ) return;

  const targets = document.querySelectorAll<HTMLElement>(
    ".capabilities_card > .image, " +
    ".cases_wrap .card_wrap.case, " +
    ".creators-direction_photo .image, " +
    ".cta-marquee_wrap",
  );
  const maxTilt = 2;

  targets.forEach((target) => {
    target.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
  });

  const reset = () => {
    targets.forEach((target) => (target.style.transform = ""));
  };

  const move = (event: PointerEvent) => {
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (
        rect.bottom < 0 || rect.top > innerHeight ||
        rect.right < 0 || rect.left > innerWidth
      ) continue;

      const x = (event.clientX - rect.left - rect.width / 2) / innerWidth;
      const tiltY = Math.max(-1, Math.min(1, x * 2)) * maxTilt;
      target.style.transform = `perspective(1000px) rotateY(${tiltY}deg)`;
    }
  };

  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerleave", reset);
  window.addEventListener("blur", reset);

  return () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerleave", reset);
    window.removeEventListener("blur", reset);
    targets.forEach((target) => {
      target.style.transform = "";
      target.style.transition = "";
    });
  };
}
