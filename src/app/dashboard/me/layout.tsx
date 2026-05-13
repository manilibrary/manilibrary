export default function MemberAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 xl:max-w-7xl">{children}</div>
  );
}
