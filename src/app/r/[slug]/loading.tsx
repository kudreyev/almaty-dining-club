export default function LoadingRestaurant() {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="h-10 w-96 max-w-full rounded-2xl bg-gray-100" />
  
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 rounded-full bg-gray-100" />
          <div className="h-8 w-28 rounded-full bg-gray-100" />
        </div>
  
        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="aspect-[4/3] bg-gray-100" />
            </div>
  
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-6 w-48 rounded-full bg-gray-100" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                  <div className="h-4 w-20 rounded-full bg-gray-100" />
                  <div className="mt-3 h-4 w-2/3 rounded-full bg-gray-100" />
                  <div className="mt-2 h-4 w-1/2 rounded-full bg-gray-100" />
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="h-4 w-20 rounded-full bg-gray-100" />
                  <div className="mt-3 h-4 w-40 rounded-full bg-gray-100" />
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="h-4 w-20 rounded-full bg-gray-100" />
                  <div className="mt-3 h-4 w-44 rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
          </div>
  
          <aside className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-6 w-40 rounded-full bg-gray-100" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-gray-50 p-4">
                    <div className="h-7 w-20 rounded-full bg-gray-100" />
                    <div className="mt-3 h-4 w-56 rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-44 rounded-full bg-gray-100" />
                    <div className="mt-4 h-10 w-44 rounded-2xl bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    )
  }