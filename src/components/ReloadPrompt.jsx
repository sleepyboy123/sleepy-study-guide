import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-slate-300 bg-white p-4 shadow-lg">
      <p className="mb-3 text-sm text-slate-700">
        A new version is available.
      </p>
      <div className="flex gap-2">
        <button
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          onClick={() => updateServiceWorker(true)}
        >
          Update now
        </button>
        <button
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </div>
    </div>
  )
}
