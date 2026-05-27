import { z } from "zod";
import { validateRealestateUrl } from "@/lib/property-import/validateUrl";
import { fetchListingHtml } from "@/lib/property-import/fetchListingHtml";
import { parseRealestateHtml } from "@/lib/property-import/parseRealestateHtml";
import {
  importFromDomainQuery,
  importFromDomainRealestateUrl,
  importFromDomainUrl,
} from "@/lib/property-import/importFromDomain";

const BodySchema = z.object({
  realestateUrl: z.string().trim().optional(),
  domainUrl: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const realestateUrl = body.realestateUrl || "";
    const domainUrl = body.domainUrl || "";
    const address = body.address || "";

    if (!realestateUrl && !domainUrl && !address) {
      return Response.json(
        {
          ok: false,
          error: "Enter an address, Domain URL, or realestate URL.",
          manualRequired: true,
        },
        { status: 400 },
      );
    }

    let imported;
    if (domainUrl) {
      imported = await importFromDomainUrl(domainUrl);
    } else if (address) {
      const domainImported = await importFromDomainQuery(address);
      if (!domainImported) {
        return Response.json(
          {
            ok: false,
            error: "No Domain listing match found for this address.",
            manualRequired: true,
          },
          { status: 404 },
        );
      }
      imported = domainImported;
    } else {
      const validatedRealestateUrl = validateRealestateUrl(realestateUrl);
      try {
        const html = await fetchListingHtml(validatedRealestateUrl.toString());
        imported = parseRealestateHtml(html, validatedRealestateUrl.toString());
      } catch (error) {
        const message = error instanceof Error ? error.message : "Realestate import failed";
        if (!message.includes("HTTP 429") && !message.toLowerCase().includes("blocked automated import")) {
          throw error;
        }

        const domainImported = await importFromDomainRealestateUrl(
          validatedRealestateUrl.toString(),
        );
        if (!domainImported) {
          return Response.json(
            {
              ok: false,
              error: "Could not find a matching Domain listing for this realestate URL.",
              manualRequired: true,
            },
            { status: 404 },
          );
        }

        imported = domainImported;
      }
    }

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
        manualRequired: true,
      },
      { status: 400 },
    );
  }
}
