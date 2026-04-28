import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  text: z.string().min(1),
  vehicleId: z.string().min(1),
});

const systemPrompt =
  "You are a vehicle logbook assistant. Extract structured data from the user's description of a car service or modification. Return valid JSON only, no prose. If a field cannot be determined, return null for that field.";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rateLimitQuery = (supabase as unknown as {
      from: (
        table: "ai_parse_events",
      ) => {
        select: (
          columns: string,
          options: { count: "exact"; head: true },
        ) => {
          eq: (column: string, value: string) => {
            gte: (
              column: string,
              value: string,
            ) => Promise<{ count: number | null }>;
          };
        };
      };
    })
      .from("ai_parse_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", cutoff);

    const { count } = await rateLimitQuery;

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "Rate limit exceeded (10 requests/hour)" },
        { status: 429 },
      );
    }

    const client = getAnthropicClient();
    const model = "claude-haiku-4-5";
    const response = await client.messages.create({
      model,
      max_tokens: 900,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Vehicle ID: ${parsedBody.data.vehicleId}\n\nDescription:\n${parsedBody.data.text}\n\nReturn JSON with fields: category,title,date,odometer_miles,parts,shop_name,total_cost,notes,performed_by.`,
        },
      ],
    });

    const textContent = response.content
      .map((c) => ("text" in c ? c.text : ""))
      .join("")
      .trim();

    let parsed: unknown = null;
    try {
      const jsonOnly = textContent.replace(/^```json\s*|\s*```$/g, "");
      parsed = JSON.parse(jsonOnly);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw: textContent },
        { status: 502 },
      );
    }

    await (supabase as unknown as {
      from: (
        table: "ai_parse_events",
      ) => {
        insert: (row: {
          user_id: string;
          vehicle_id: string;
        }) => Promise<unknown>;
      };
    })
      .from("ai_parse_events")
      .insert({ user_id: user.id, vehicle_id: parsedBody.data.vehicleId });

    return NextResponse.json({ parsed });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI parse failed" },
      { status: 500 },
    );
  }
}
