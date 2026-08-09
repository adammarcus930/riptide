import { useRegisterSW } from 'virtual:pwa-register/react';

// Replaces the "close and reopen the app twice" dance: when a new build is
// waiting, offer a one-tap update.
export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 flex justify-center">
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-full bg-accent px-4 py-2.5 text-[13px] font-extrabold text-on-accent shadow-cta"
      >
        New version ready — tap to update
      </button>
    </div>
  );
}
