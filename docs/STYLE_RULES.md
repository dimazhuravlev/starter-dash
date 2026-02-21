---
STYLE RULES FOR THIS PROJECT

1. Typography
- Use only existing typography variables.
- Do not use raw font-size, font-weight, line-height, or font-family values.
- Do not apply local inline text styles.

2. Colors
- Use only existing color variables.
- Do not use raw hex, rgba, hsl, or literal color values in components.

3. No new color variables
- Do not create new color variables.
- If a new color variable seems required:
  - Stop implementation.
  - Explain why existing variables are insufficient.
  - Propose a new variable with reasoning.

4. Semantic usage
- Use surface-* and fill-* variables for surfaces, backgrounds, fills, and icons.
- Use text-* variables only for text.
- Do not use text variables for backgrounds.
- Do not use surface/fill variables for text.

These rules are mandatory.
If any task conflicts with them, stop and explain before proceeding.
Always follow /docs/STYLE_RULES.md.

---
