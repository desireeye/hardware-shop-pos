type PlaceholderPageProps = {
  title: string;
  message: string;
};

function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Module</p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900">{title}</h2>
        <p className="mt-4 text-lg text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export default PlaceholderPage;
