export function Disclaimer() {
  return (
    <p className="px-2 py-4 text-center text-[11px] leading-snug text-zinc-500">
      Engineering estimate using standard GPSA methods, not OEM-certified. Gas rod loads only (no inertia); cylinder flange pressures (no valve or pulsation losses).
      Cylinder data marked placeholder is assumed. Verify critical applications with CiP engineering.
      <span className="mt-1 block text-zinc-400">v{__APP_VERSION__}</span>
    </p>
  );
}
