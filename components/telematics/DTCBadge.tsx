import { lookupDTC, parseDTCCodes } from "@/lib/dtc-codes";
import { Icon } from "@/components/ui/Icon";

type Props = {
  raw: string | string[] | null | undefined;
};

export function DTCBadge({ raw }: Props) {
  const codes = parseDTCCodes(raw);
  if (!codes.length) return <span className="text-wm-text2">—</span>;

  return (
    <div className="space-y-1">
      {codes.map((code) => (
        <div key={code} className="group relative">
          <div className="flex items-center gap-1">
            <Icon name="warning_amber" className="text-wm-red" size={14} />
            <span className="label-technical text-wm-red">{code}</span>
          </div>
          <p className="text-xs text-wm-text2 mt-0.5">{lookupDTC(code)}</p>
        </div>
      ))}
    </div>
  );
}
