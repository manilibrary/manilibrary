/** Thin indeterminate progress line (overview / admin panels). */
export default function TopLoadingBar() {
  return (
    <div
      className="h-0.5 w-full overflow-hidden bg-azure-100"
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="top-loading-bar-indeterminate h-full w-1/3 bg-azure-500" />
    </div>
  );
}
