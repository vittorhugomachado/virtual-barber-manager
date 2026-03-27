export function Logo({ style }: { style?: string }) {
  return (
    <div className={`${style} flex items-center gap-2`}>
      <img
        src="/logo-dark.png"
        alt="logo"
        width={600}
        height={63}
        loading="eager"
        decoding="async"
        className="hidden dark:block object-contain"
      />
      <img
        src="/logo-light.png"
        alt="logo"
        width={600}
        height={61}
        loading="eager"
        decoding="async"
        className="object-contain dark:hidden"
      />
    </div>
  );
}
