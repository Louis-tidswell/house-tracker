import { z } from "zod";
import { validateRealestateUrl } from "@/lib/property-import/validateUrl";
import { fetchListingHtml } from "@/lib/property-import/fetchListingHtml";
import { parseRealestateHtml } from "@/lib/property-import/parseRealestateHtml";

const BodySchema = z.object({
  url: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const url = validateRealestateUrl(body.url);

    const html = await fetchListingHtml(url.toString());
    const imported = parseRealestateHtml(html, url.toString());

    return Response.json({
      ok: true,
      property: imported,
      warnings: [
        "Auto-import is best-effort. Review fields before saving.",
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown import error";

    return Response.json(
      {
        ok: false,
        error: message,
        fallback: {
          message:
            "Could not auto-import this listing. Add it manually or try a bookmarklet/browser-extension approach later.",
        },
      },
      { status: 400 },
    );
  }
}