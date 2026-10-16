import { Icon } from "@/components/ui/Icon";
import type { CheckEngineState } from "@/components/telematics/useCheckEngine";

export function CheckEngineStatus({ state }: { state: CheckEngineState | undefined }) {
  if (!state || state.status === "loading") return <span className="text-wm-text3">…</span>;
  if (state.status === "no_device") return <span className="text-wm-text2">—</span>;
  if (state.status === "error") return <span className="text-sm text-wm-text3">Status unavailable</span>;

  if (state.milOn) {
    return (
      <div>
        <div className="flex items-center gap-1">
          <Icon name="warning_amber" className="text-wm-red" size={14} />
          <span className="label-technical text-wm-red">Check engine light on</span>
        </div>
        {state.lastEventAt && (
          <p className="mt-0.5 text-xs text-wm-text2">{new Date(state.lastEventAt).toLocaleString()}</p>
        )}
      </div>
    );
  }
  return <span className="text-sm text-wm-text2">No faults reported</span>;
}
