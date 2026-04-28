import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { LogbookCategory, LogbookEntryMode } from "@/types/database";

export type PartDraft = {
  part_name: string;
  quantity?: number | null;
  unit_cost?: number | null;
};

export type SaveLogbookInput = {
  vehicleId: string;
  category: LogbookCategory;
  title: string;
  odometer_miles?: number | null;
  event_date: string;
  total_cost?: number | null;
  shop_name?: string | null;
  performed_by?: string | null;
  notes?: string | null;
  parts: PartDraft[];
  files: File[];
  entry_mode: LogbookEntryMode;
};

function attachmentTypeFor(file: File): "photo" | "receipt" | "document" | "video" {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf")) return "receipt";
  return "document";
}

export async function saveLogbookEntry(
  supabase: SupabaseClient,
  user: User,
  input: SaveLogbookInput,
) {
  const entryInsert = (supabase as unknown as {
    from: (
      table: "logbook_entries",
    ) => {
      insert: (row: Record<string, unknown>) => {
        select: (fields: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("logbook_entries")
    .insert({
      vehicle_id: input.vehicleId,
      user_id: user.id,
      category: input.category,
      title: input.title,
      odometer_miles: input.odometer_miles ?? null,
      event_date: input.event_date,
      total_cost: input.total_cost ?? null,
      shop_name: input.shop_name ?? null,
      performed_by: input.performed_by ?? null,
      notes: input.notes ?? null,
      entry_mode: input.entry_mode,
      is_public: false,
    })
    .select("id")
    .single();
  const { data: entry, error: entryError } = await entryInsert;

  if (entryError || !entry) {
    throw new Error(entryError?.message ?? "Failed to create logbook entry.");
  }

  const entryId = entry.id as string;
  const validParts = input.parts.filter((p) => p.part_name.trim().length > 0);

  if (validParts.length > 0) {
    const partRows = validParts.map((p) => ({
      entry_id: entryId,
      part_name: p.part_name.trim(),
      quantity: p.quantity ?? 1,
      unit_cost: p.unit_cost ?? null,
      user_part_id: null,
    }));

    const partsInsert = (supabase as unknown as {
      from: (
        table: "logbook_entry_parts",
      ) => {
        insert: (rows: Array<Record<string, unknown>>) => Promise<{
          error: { message: string } | null;
        }>;
      };
    })
      .from("logbook_entry_parts")
      .insert(partRows);
    const { error: partsError } = await partsInsert;
    if (partsError) {
      throw new Error(partsError.message);
    }

    for (const part of validParts) {
      const partName = part.part_name.trim();
      const existingQuery = (supabase as unknown as {
        from: (
          table: "user_custom_parts",
        ) => {
          select: (fields: string) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{
                  data: { id?: string; use_count?: number } | null;
                }>;
              };
            };
          };
        };
      })
        .from("user_custom_parts")
        .select("id,use_count")
        .eq("user_id", user.id)
        .eq("part_name", partName)
        .maybeSingle();
      const { data: existing } = await existingQuery;

      if (existing?.id) {
        await (supabase as unknown as {
          from: (
            table: "user_custom_parts",
          ) => {
            update: (row: Record<string, unknown>) => {
              eq: (column: string, value: string) => Promise<unknown>;
            };
          };
        })
          .from("user_custom_parts")
          .update({ use_count: (existing.use_count ?? 0) + 1 })
          .eq("id", existing.id);
      } else {
        await (supabase as unknown as {
          from: (
            table: "user_custom_parts",
          ) => {
            insert: (row: Record<string, unknown>) => Promise<unknown>;
          };
        })
          .from("user_custom_parts")
          .insert({
            user_id: user.id,
            part_name: partName,
            default_cost: part.unit_cost ?? null,
            use_count: 1,
          });
      }
    }
  }

  if (input.files.length > 0) {
    const attachmentRows: Array<Record<string, unknown>> = [];
    for (const file of input.files) {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `${user.id}/${entryId}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("logbook-attachments")
        .upload(path, file, { upsert: false });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      attachmentRows.push({
        entry_id: entryId,
        user_id: user.id,
        attachment_type: attachmentTypeFor(file),
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || null,
      });
    }

    const attachInsert = (supabase as unknown as {
      from: (
        table: "logbook_attachments",
      ) => {
        insert: (rows: Array<Record<string, unknown>>) => Promise<{
          error: { message: string } | null;
        }>;
      };
    })
      .from("logbook_attachments")
      .insert(attachmentRows);
    const { error: attachError } = await attachInsert;
    if (attachError) {
      throw new Error(attachError.message);
    }
  }

  return { entryId };
}
