"""
RAG-based natural language Q&A over the policy database.

Strategy (no vector embeddings required for MVP):
  1. Parse the question to identify drug name + payer name + question type.
  2. Pull relevant coverage_rules rows from Supabase using structured queries.
  3. Pass those rows as context to Claude to generate a plain-language answer.

This avoids needing pgvector setup for the hackathon while still giving accurate,
grounded answers — Claude sees the actual policy data, not hallucinated facts.
"""
import json

import anthropic

from database.supabase_client import get_client

SYSTEM_PROMPT = """You are Coverage360, an AI assistant that helps market access analysts
answer questions about medical benefit drug coverage policies across health plans.

You will be given structured coverage data from a policy database and must answer
the user's question accurately based ONLY on that data.

Rules:
- Never invent coverage information not present in the data.
- If the data doesn't contain enough information, say so clearly.
- Be concise and specific — analysts need facts, not summaries.
- When listing PA criteria, present them as a clear bulleted list.
- When comparing payers, use a structured format (payer | status | step therapy | PA required).
- Always mention the policy effective date so the analyst knows how current the information is.
- Focus exclusively on commercial medical benefit policies.
"""


def _fetch_context(question: str) -> tuple[list[dict], str]:
    """
    Heuristically pull relevant rows from coverage_rules based on the question.
    Returns (rows, search_summary).
    """
    client = get_client()
    q_lower = question.lower()

    # Try to extract drug name from question (crude but effective for demo)
    drug_terms = []
    for word in question.split():
        cleaned = word.strip("?.,;:'\"").lower()
        if len(cleaned) > 4:  # ignore short words
            drug_terms.append(cleaned)

    # Try each potential drug term against the DB
    rows = []
    for term in drug_terms:
        result = (
            client.table("coverage_rules")
            .select(
                "drug_brand_name, drug_generic_name, hcpcs_code, indication_name, "
                "coverage_status, requires_prior_auth, pa_criteria, step_therapy, "
                "dosing, limitations, line_of_therapy, combination_drugs, "
                "policies(policy_title, policy_number, effective_date, payers(name, short_name))"
            )
            .or_(f"drug_generic_name.ilike.%{term}%,drug_brand_name.ilike.%{term}%")
            .limit(30)
            .execute()
        )
        if result.data:
            rows.extend(result.data)
            break  # found data, stop searching

    # If we have a payer name in the question, filter further
    payer_keywords = {
        "cigna": "cigna",
        "uhc": "unitedhealthcare",
        "united": "unitedhealthcare",
        "bcbs": "blue cross",
        "florida blue": "florida blue",
        "priority health": "priority health",
        "emblem": "emblem",
    }
    for kw, payer_fragment in payer_keywords.items():
        if kw in q_lower:
            rows = [
                r for r in rows
                if payer_fragment in ((r.get("policies") or {}).get("payers") or {}).get("name", "").lower()
            ]
            break

    # Deduplicate
    seen, deduped = set(), []
    for r in rows:
        key = (r.get("drug_generic_name"), r.get("indication_name"),
               (r.get("policies") or {}).get("policy_title"))
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    payer_set = {(r.get("policies") or {}).get("payers", {}).get("name") for r in deduped}
    search_summary = f"Found {len(deduped)} relevant coverage rule(s) across {len(payer_set)} payer(s)."
    return deduped[:20], search_summary  # cap context at 20 rows


async def answer_question(question: str, api_key: str) -> dict:
    """
    Main RAG entry point. Returns {question, answer, sources, context_rows_used}.
    """
    rows, search_summary = _fetch_context(question)

    if not rows:
        return {
            "question": question,
            "answer": "I couldn't find any coverage data matching your question. "
                      "Make sure the relevant policies have been ingested first.",
            "sources": [],
            "context_rows_used": 0,
        }

    # Format context for Claude
    context_lines = []
    sources = []
    for r in rows:
        policy = r.get("policies") or {}
        payer = policy.get("payers") or {}
        payer_name = payer.get("name", "Unknown Payer")
        effective = policy.get("effective_date", "unknown date")

        source = f"{payer_name} — {policy.get('policy_title', '')} (effective {effective})"
        if source not in sources:
            sources.append(source)

        context_lines.append(
            f"PAYER: {payer_name} | POLICY: {policy.get('policy_title')} | "
            f"EFFECTIVE: {effective}\n"
            f"  Drug: {r.get('drug_brand_name') or ''} ({r.get('drug_generic_name')})\n"
            f"  Indication: {r.get('indication_name') or 'All indications'}\n"
            f"  Coverage Status: {r.get('coverage_status')}\n"
            f"  Requires PA: {r.get('requires_prior_auth')}\n"
            f"  Step Therapy: {json.dumps(r.get('step_therapy')) if r.get('step_therapy') else 'None'}\n"
            f"  PA Criteria: {json.dumps(r.get('pa_criteria')) if r.get('pa_criteria') else 'None'}\n"
            f"  Dosing: {json.dumps(r.get('dosing')) if r.get('dosing') else 'None'}\n"
            f"  Limitations: {', '.join(r.get('limitations') or []) or 'None'}\n"
        )

    context_text = "\n---\n".join(context_lines)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"COVERAGE DATABASE CONTEXT:\n{context_text}\n\n"
                    f"USER QUESTION: {question}"
                ),
            }
        ],
    )

    return {
        "question": question,
        "answer": message.content[0].text,
        "sources": sources,
        "context_rows_used": len(rows),
    }
