export const Logo = ({ style }: { style?: string }) => {
  return (
    <div className={`${style} flex items-center gap-2`}>
      <img
        src="/logo-dark.png"
        alt="logo"
        className="hidden dark:block object-contain"
      />
      <img
        src="/logo-light.png"
        alt="logo"
        className="object-contain dark:hidden"
      />
    </div>
  );
};
