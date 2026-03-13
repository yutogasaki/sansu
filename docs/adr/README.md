# ADR Guide

## Purpose

Architecture Decision Records store non-obvious decisions that are expensive to rediscover.

## When To Write An ADR

- Data model or storage changes
- PWA/cache/update decisions
- Routing or onboarding flow decisions
- Learning algorithm thresholds or behavior changes
- Design-system decisions with long-term impact

## When Not To Write One

- Simple refactors
- Pure bug fixes with obvious cause
- Temporary task notes

## Naming

- Copy [0000-template.md](0000-template.md)
- Rename to `YYYY-MM-DD-short-title.md`

## Quality Rules

- Keep it short
- State the decision plainly
- Record alternatives and downsides
- Link to the spec or runbook it affects
- Include `Date`, `Status`, `Related spec`, and `Related task`
- Run `npm run docs:check` after adding or editing an ADR
