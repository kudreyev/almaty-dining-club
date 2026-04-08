export default function LoadingHome() {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <section className="rounded-[2rem] border border-gray-200 bg-white px-8 py-14 shadow-sm md:px-14">
          <div className="h-4 w-40 rounded-full bg-gray-100" />
          <div className="mt-6 h-10 w-full max-w-3xl rounded-2xl bg-gray-100" />
          <div className="mt-3 h-10 w-full max-w-2xl rounded-2xl bg-gray-100" />
  
          <div className="mt-8 flex gap-3">
            <div className="h-11 w-48 rounded-2xl bg-gray-200" />
            <div className="h-11 w-48 rounded-2xl bg-gray-100" />
          </div>
        </section>
  
        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <div className="mb-2 h-4 w-16 rounded-full bg-gray-100" />
              <div className="h-11 w-full rounded-2xl bg-gray-100" />
            </div>
            <div>
              <div className="mb-2 h-4 w-32 rounded-full bg-gray-100" />
              <div className="h-11 w-full rounded-2xl bg-gray-100" />
            </div>
            <div className="flex items-end">
              <div className="h-11 w-full rounded-2xl bg-gray-200" />
            </div>
          </div>
        </section>
  
        <section className="mt-10">
          <div className="mb-6">
            <div className="h-6 w-36 rounded-full bg-gray-100" />
            <div className="mt-3 h-4 w-64 rounded-full bg-gray-100" />
          </div>
  
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-gray-100" />
                <div className="p-5">
                  <div className="h-6 w-2/3 rounded-full bg-gray-100" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-7 w-20 rounded-full bg-gray-100" />
                    <div className="h-7 w-24 rounded-full bg-gray-100" />
                  </div>
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                    <div className="h-4 w-48 rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-56 rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-40 rounded-full bg-gray-100" />
                  </div>
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                    <div className="h-4 w-40 rounded-full bg-gray-100" />
                    <div className="mt-2 h-4 w-56 rounded-full bg-gray-100" />
                  </div>
                  <div className="mt-5 h-10 w-44 rounded-2xl bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    )
  }