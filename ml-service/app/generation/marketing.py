"""Marketing copy generation (email, ad, product description, sms, push)."""
from __future__ import annotations

from ..schemas import MarketingRequest, MarketingResponse
from . import llm


def _fallback(req: MarketingRequest) -> MarketingResponse:
    name = req.product_name or req.topic
    audience = req.audience or "valued customers"
    if req.kind == "email":
        subject = f"{name}: a special pick for you"
        body = (
            f"Hi there,\n\nWe thought {audience} like you would love {name}. "
            f"{req.topic}.\n\nShop now on OceanBazar and enjoy fast delivery across Bangladesh, "
            f"secure payments (bKash, Nagad, SSLCommerz, COD) and OB Points rewards on every order.\n\n"
            f"Happy shopping,\nThe OceanBazar Team"
        )
        return MarketingResponse(source="template", subject=subject, body=body)
    if req.kind == "sms":
        return MarketingResponse(source="template", subject=None,
                                 body=f"OceanBazar: {name} is here! {req.topic}. Order now & earn OB Points. Reply STOP to opt out.")
    if req.kind == "push":
        return MarketingResponse(source="template", subject=f"{name} just for you",
                                 body=f"{req.topic} — tap to shop on OceanBazar.")
    if req.kind == "ad_copy":
        return MarketingResponse(source="template", subject=None,
                                 body=f"{name} | {req.topic}. Best prices in Bangladesh. Free OB Points on every order. Shop OceanBazar today!")
    # product_description
    return MarketingResponse(source="template", subject=None,
                             body=f"{name} — {req.topic}. Authentic, quality-checked and delivered fast across Bangladesh by OceanBazar.")


def generate(req: MarketingRequest) -> MarketingResponse:
    system = (
        "You are a senior e-commerce marketing copywriter for OceanBazar, a Bangladesh-based "
        "online marketplace. Write concise, persuasive, conversion-focused copy. "
        "Mention OB Points loyalty and local payment options (bKash/Nagad/COD) when relevant. "
        f"Write in {'Bangla' if req.language == 'bn' else 'English'}."
    )
    user = (
        f"Channel: {req.kind}\nTopic: {req.topic}\nAudience: {req.audience or 'general shoppers'}\n"
        f"Tone: {req.tone}\nProduct: {req.product_name or 'n/a'}\nExtra: {req.extra_context or 'n/a'}\n\n"
    )
    if req.kind == "email":
        user += "Return the subject line on the first line prefixed with 'SUBJECT:' then the email body."
    text = llm.complete(system, user, max_tokens=700)
    if not text:
        return _fallback(req)

    subject = None
    body = text
    if req.kind == "email" and "SUBJECT:" in text:
        first, _, rest = text.partition("\n")
        subject = first.replace("SUBJECT:", "").strip()
        body = rest.strip()
    return MarketingResponse(source="openai", subject=subject, body=body)
