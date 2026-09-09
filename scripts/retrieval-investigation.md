# Full-page retrieval investigation

The website parser no longer stops at the first section heading. It reads explicit bed/bath/parking counts from the listing's header, property features and address-matched description. It excludes AI-generated highlights, recommendations, agent information and suburb statistics. Offline regressions cover number words, tables, labels on separate lines, conflicting counts, and exclusion boundaries.

Full-page retrieval remains unresolved for listing 152168452. The following bounded live checks used **three Tavily credits total**. No repeated live calls were used for parser tests or theme checks, and the production request remains one basic search per click.

| Check | Result | Tavily credits |
| --- | --- | --- |
| Advanced Extract with `%2B` in the URL | Failed to fetch URL | 0 |
| Advanced Search for the exact URL, requesting raw Markdown | Matching short excerpt; `raw_content: null` | 2 |
| Basic Search for the quoted listing ID plus feature keywords | Explicit `Garage spaces: 2`, but no total bathroom count and `raw_content: null` | 1 |
| Jina Reader anonymous full-page request | Access Denied; target HTTP 403 | 0 |

The targeted search is not enabled as an automatic second request: it returned fewer other fields and still did not resolve full retrieval. `Ensuites: 1` is not treated as the total number of bathrooms. No extra provider, API key, advanced mode, or paid retry has been added to the app.

## Prepared Tavily support request (not sent)

We are importing explicit fields from a public realestate.com.au listing into a personal property tracker:

https://www.realestate.com.au/property-apartment-qld-east+brisbane-152168452

Search finds the exact URL but returns `raw_content: null` despite `include_raw_content: "markdown"`. Both basic and advanced Extract return `Failed to fetch url`. Encoding the plus sign as `%2B` also fails. Could you confirm whether this domain is supported for full extraction and identify the upstream failure? Is there a supported configuration that returns the listing description and property features, including bathrooms and parking?

Request IDs:

- Advanced Extract: `1901d0b9-bc42-4248-899a-4ba006d69ab0`
- Advanced Search: `630ec662-a38a-4102-bddd-504455c41f8c`
- Basic feature search: `c0009dda-e50c-469e-892d-6ce8d7c93b31`

No API key is included in this report. Completing URL-only full-page import needs either a provider-side resolution or a verified alternative retrieval service.
