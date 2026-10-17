export default function App() {
  return (
    <div className="foundation-shell relative isolate flex min-h-svh flex-col overflow-hidden bg-[#080d20] text-slate-100">
      <div className="starfield pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <header className="flex items-center justify-between gap-4 px-6 py-7 sm:px-12 sm:py-9">
        <a className="brand inline-flex items-center gap-3 rounded-sm" href="#main">
          <span className="brand-star text-2xl text-violet-300" aria-hidden="true">✧</span>
          <span className="text-sm font-medium tracking-wide">Gacha Picker</span>
        </a>
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">The beginning</span>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 text-center sm:py-16">
        <div className="cosmic-seal relative mb-10 grid h-32 w-32 place-items-center sm:h-40 sm:w-40" aria-hidden="true">
          <div className="seal-orbit absolute inset-0 rounded-full" />
          <div className="seal-orbit seal-orbit-inner absolute inset-4 rounded-full" />
          <span className="seal-star select-none text-6xl text-violet-200 sm:text-7xl">✧</span>
          <span className="seal-satellite absolute right-0 top-5 h-1.5 w-1.5 rounded-full bg-sky-200" />
        </div>

        <p className="mb-5 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-violet-300 sm:text-xs">A little chance. A little wonder.</p>
        <h1 className="project-title text-6xl leading-tight tracking-tight sm:text-8xl">Gacha Picker</h1>
        <p className="mt-6 max-w-md text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
          A new way to leave it to chance. A random name picker with a cosmic summoning experience, coming to life one stage at a time.
        </p>

        <p className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-violet-300/15 bg-violet-300/5 px-4 py-2.5 text-xs tracking-wide text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#7dd3fc66]" aria-hidden="true" />
          Foundation ready
        </p>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/5 px-6 py-6 text-[0.65rem] tracking-wide text-slate-400 sm:px-12">
        <span>Stage 01 <span className="px-2 text-slate-600" aria-hidden="true">/</span> Project foundation</span>
        <span>The journey starts here.</span>
      </footer>
    </div>
  )
}
