"""
openFDA drug name resolution.
Maps user-entered drug names (brand or generic) to normalized generic names
so searches work regardless of whether a user types "Avastin" or "bevacizumab".
"""
import httpx

OPENFDA_URL = "https://api.fda.gov/drug/label.json"

# In-process cache — avoids repeat openFDA round-trips for the same name
_cache: dict[str, str | None] = {}


def resolve_drug_name(name: str) -> str | None:
    """
    Given a brand or generic drug name, return the normalized generic name from openFDA.
    Returns None if the drug can't be resolved (searches still work with original name).
    """
    key = name.lower().strip()
    if key in _cache:
        return _cache[key]

    result = None
    try:
        response = httpx.get(
            OPENFDA_URL,
            params={
                "search": f'(openfda.brand_name:"{name}" openfda.generic_name:"{name}")',
                "limit": 1,
            },
            timeout=2.0,  # reduced from 5s — failure is non-fatal, don't block searches
        )
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if results:
                openfda = results[0].get("openfda", {})
                generics = openfda.get("generic_name", [])
                result = generics[0].lower() if generics else None
    except Exception:
        pass

    _cache[key] = result
    return result
