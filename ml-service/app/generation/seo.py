"""SEO metadata generation: meta title/description, keywords, schema.org, FAQ."""
from __future__ import annotations

import json
import re

from ..schemas import SeoRequest, SeoResponse
from . import llm


def _truncate(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "\u2026"


def _keywords_from(req: SeoRequest) -> list[str]:
    base = set(k.lower() for k in (req.keywords or []))
    for token in re.findall(r"[a-zA-Z\u0980-\u09FF]{3,}", f"{req.name} {req.category or ''}"):
        base.add(token.lower())
    base.update({"oceanbazar", "bangladesh", "online shopping", "buy online"})
    return sorted(base)[:15]


def _score(title: str, desc: str, keywords: list[str]) -> int:
    score = 0
    if 30 <= len(title) <= 60:
        score += 30
    elif title:
        score += 15
    if 70 <= len(desc) <= 160:
        score += 30
    elif desc:
        score += 15
    score += min(25, len(keywords) * 2)
    score += 15  # schema + faq always present
    return min(100, score)


def _schema(req: SeoRequest, title: str, desc: str) -> dict:
    type_map = {"product": "Product", "category": "CollectionPage", "brand": "Brand", "page": "WebPage"}
    node = {
        "@context": "https://schema.org",
        "@type": type_map.get(req.entity_type, "WebPage"),
        "name": req.name,
        "description": desc,
    }
    if req.canonical_url:
        node["url"] = req.canonical_url
    if req.entity_type == "product":
        node["brand"] = {"@type": "Brand", "name": req.category or "OceanBazar"}
        node["offers"] = {"@type": "Offer", "availability": "https://schema.org/InStock",
                          "priceCurrency": "BDT", "seller": {"@type": "Organization", "name": "OceanBazar"}}
    return node


def _fallback(req: SeoRequest) -> SeoResponse:
    suffix = " | OceanBazar Bangladesh"
    title = _truncate(f"{req.name}{(' - ' + req.category) if req.category else ''}", 60 - len(suffix)) + suffix
    base_desc = req.description or f"Buy {req.name} online in Bangladesh at the best price."
    desc = _truncate(f"{base_desc} Fast delivery, secure payment & OB Points rewards on OceanBazar.", 160)
    keywords = _keywords_from(req)
    faq = [
        {"question": f"Is {req.name} available for delivery across Bangladesh?",
         "answer": f"Yes. OceanBazar delivers {req.name} nationwide with reliable courier partners."},
        {"question": f"What payment methods can I use to buy {req.name}?",
         "answer": "You can pay with bKash, Nagad, SSLCommerz cards or Cash on Delivery."},
    ]
    return SeoResponse(source="template", meta_title=title, meta_description=desc, keywords=keywords,
                       schema_json=_schema(req, title, desc), faq=faq, seo_score=_score(title, desc, keywords))


def generate(req: SeoRequest) -> SeoResponse:
    system = (
        "You are an SEO specialist for OceanBazar (Bangladesh e-commerce). "
        "Return STRICT JSON with keys: meta_title (<=60 chars), meta_description (<=160 chars), "
        "keywords (array of 8-15 strings), faq (array of {question, answer}, 2-4 items). "
        f"Write in {'Bangla' if req.language == 'bn' else 'English'}. No markdown, JSON only."
    )
    user = (
        f"Entity type: {req.entity_type}\nName: {req.name}\nCategory: {req.category or 'n/a'}\n"
        f"Description: {req.description or 'n/a'}\nSeed keywords: {', '.join(req.keywords or []) or 'n/a'}"
    )
    text = llm.complete(system, user, max_tokens=700, temperature=0.5)
    if not text:
        return _fallback(req)
    try:
        cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
        data = json.loads(cleaned)
        title = _truncate(str(data.get("meta_title") or req.name), 65)
        desc = _truncate(str(data.get("meta_description") or ""), 165)
        keywords = [str(k) for k in (data.get("keywords") or [])][:15] or _keywords_from(req)
        faq = [
            {"question": str(f.get("question", "")), "answer": str(f.get("answer", ""))}
            for f in (data.get("faq") or [])
            if isinstance(f, dict)
        ]
        return SeoResponse(source="openai", meta_title=title, meta_description=desc, keywords=keywords,
                           schema_json=_schema(req, title, desc), faq=faq, seo_score=_score(title, desc, keywords))
    except Exception:
        return _fallback(req)
