"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatDistance } from "@/lib/format-distance";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import type {
  LogbookAttachment,
  LogbookCategory,
  LogbookEntry,
  LogbookEntryPart,
} from "@/types/database";

export type LogbookEntryWithDetails = LogbookEntry & {
  attachment_count: number;
  logbook_attachments: LogbookAttachment[];
  logbook_entry_parts: LogbookEntryPart[];
};

function categoryMeta(category: LogbookCategory) {
  if (category === "maintenance") {
    return { iconName: "build", bg: "bg-wm-accent/20", text: "text-wm-accent", borderL: "border-l-wm-accent-dark" };
  }
  if (category === "modification") {
    return { iconName: "tune", bg: "bg-wm-purple/20", text: "text-wm-purple", borderL: "border-l-wm-purple" };
  }
  return { iconName: "description", bg: "bg-wm-gold/20", text: "text-wm-gold", borderL: "border-l-wm-gold" };
}

type Props = {
  entry: LogbookEntryWithDetails;
  onEdit: (entry: LogbookEntryWithDetails) => void;
};

export function EntryCard({ entry, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = categoryMeta(entry.category);
  const { settings } = useUserSettings();
  const distanceUnit = settings.distance_unit ?? "miles";

  return (
    <article className={`rounded-none border border-wm-border border-l-4 ${meta.borderL} bg-wm-s1 transition hover:border-wm-accent/60`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-sm ${meta.bg} ${meta.text}`}
        >
          <Icon name={meta.iconName} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-headline truncate text-base font-semibold text-wm-text">{entry.title}</h4>
            <span className={`label-technical rounded-sm px-2 py-0.5 ${meta.bg} ${meta.text}`}>
              {entry.category}
            </span>
          </div>
          <p className="mt-1 text-xs text-wm-text2">
            {entry.event_date} · {formatDistance(entry.odometer_miles, distanceUnit)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {entry.total_cost != null && entry.total_cost > 0 && (
              <span className="font-medium text-wm-gold">${entry.total_cost}</span>
            )}
            {entry.attachment_count > 0 && (
              <span className="rounded-sm bg-wm-s3 px-2 py-0.5 text-wm-text2">
                {entry.attachment_count} attachment
                {entry.attachment_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-wm-border px-4 py-3">
          {entry.notes ? (
            <p className="text-sm text-wm-text2">{entry.notes}</p>
          ) : (
            <p className="text-sm text-wm-text3">No notes.</p>
          )}

          {entry.logbook_entry_parts.length > 0 && (
            <div className="mt-3">
              <p className="label-technical text-wm-text3">
                Parts
              </p>
              <ul className="mt-1 space-y-1 text-sm text-wm-text2">
                {entry.logbook_entry_parts.map((part) => (
                  <li key={part.id}>
                    {part.part_name} · qty {part.quantity ?? 1}
                    {part.unit_cost != null ? ` · $${part.unit_cost}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.logbook_attachments.length > 0 && (
            <div className="mt-3">
              <p className="label-technical text-wm-text3">
                Attachments
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {entry.logbook_attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="aspect-square rounded-sm border border-wm-border bg-wm-s2 p-2 text-[10px] text-wm-text3"
                  >
                    <p className="line-clamp-2">{attachment.file_name ?? "Attachment"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="label-technical flex items-center gap-1 text-wm-text3 hover:text-wm-accent"
            >
              <Icon name="edit" size={14} />
              Edit
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
