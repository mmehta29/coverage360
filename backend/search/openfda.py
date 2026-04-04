"""
openFDA drug name resolution.
Maps user-entered drug names (brand or generic) to normalized generic names
so searches work regardless of whether a user types "Avastin" or "bevacizumab".
"""
import httpx

OPENFDA_URL = "https://api.fda.gov/drug/label.json"


def resolve_drug_name(name: str) -> str | None:
    """
    Given a brand or generic drug name, return the normalized generic name from openFDA.
    Returns None if the drug can't be resolved (searches still work with original name).
    """
    try:
        response = httpx.get(
            OPENFDA_URL,
            params={
                "search": f'(openfda.brand_name:"{name}" openfda.generic_name:"{name}")',
                "limit": 1,
            },
            timeout=5.0,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        results = data.get("results", [])
        if not results:
            return None
        openfda = results[0].get("openfda", {})
        generics = openfda.get("generic_name", [])
        return generics[0].lower() if generics else None
    except Exception:
        return None
