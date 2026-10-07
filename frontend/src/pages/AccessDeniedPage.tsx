function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white px-6 py-16 text-center shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Access</p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">Access Denied</h2>
        <p className="mt-4 max-w-md text-lg text-slate-600">
          You do not have permission to access this page.
        </p>
      </div>
    </div>
  );
}

export default AccessDeniedPage;
