// Print-friendly layout. Inherits the root <html>/<body> from app/layout.tsx
// but supplies its own container without the sidebar/topbar so the page
// renders cleanly for browser print or PDF capture.

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl bg-white px-8 py-8 text-black print:max-w-none print:px-0 print:py-0">
      {children}
    </div>
  );
}
