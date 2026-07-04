# OpenClaw Integration

Bodydashboard exposes a dedicated API-key based integration for OpenClaw.

Base URL:

```text
https://bodydashboard.de/api/integrations/openclaw
```

## Create An API Key

Create the key while logged in with a normal Bodydashboard JWT:

```bash
curl -X POST https://bodydashboard.de/api/integrations/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "name": "OpenClaw",
    "provider": "openclaw",
    "scopes": ["foods:write", "meals:write", "water:write", "weight:write"]
  }'
```

The response contains `apiKey` once. Store it in OpenClaw. Bodydashboard only stores a hash.

Use the key either as:

```http
Authorization: Bearer bdoc_...
```

or:

```http
X-API-Key: bdoc_...
```

## Health Check

```bash
curl https://bodydashboard.de/api/integrations/openclaw/health \
  -H "Authorization: Bearer bdoc_..."
```

## Create Or Update Food

`externalId` or `barcode` makes the request idempotent for the user.

```bash
curl -X POST https://bodydashboard.de/api/integrations/openclaw/foods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{
    "externalId": "openclaw-banana-001",
    "name": "Banane",
    "brand": "OpenClaw",
    "category": "Obst",
    "caloriesPer100g": 89,
    "protein": 1.1,
    "fat": 0.3,
    "carbs": 23,
    "sugar": 12,
    "fiber": 2.6,
    "salt": 0
  }'
```

## Add Existing Food To Meal

```bash
curl -X POST https://bodydashboard.de/api/integrations/openclaw/meals/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{
    "date": "2026-07-02",
    "type": "SNACK",
    "foodId": "FOOD_ID",
    "amount": 120,
    "unit": "g"
  }'
```

Meal types:

```text
BREAKFAST, LUNCH, DINNER, SNACK
```

## Update Meal Item

```bash
curl -X PUT https://bodydashboard.de/api/integrations/openclaw/meals/items/MEAL_ITEM_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{ "amount": 150, "unit": "g" }'
```

You can also change `foodId`, `amount`, `unit`, and `servingName`.

## Delete Meal Item

```bash
curl -X DELETE https://bodydashboard.de/api/integrations/openclaw/meals/items/MEAL_ITEM_ID \
  -H "Authorization: Bearer bdoc_..."
```

## Quick Add Food And Meal

Creates or updates the food and immediately adds it to the meal.

```bash
curl -X POST https://bodydashboard.de/api/integrations/openclaw/meals/quick-add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{
    "date": "2026-07-02",
    "type": "SNACK",
    "amount": 120,
    "unit": "g",
    "food": {
      "externalId": "openclaw-banana-001",
      "name": "Banane",
      "brand": "OpenClaw",
      "category": "Obst",
      "caloriesPer100g": 89,
      "protein": 1.1,
      "fat": 0.3,
      "carbs": 23,
      "sugar": 12,
      "fiber": 2.6,
      "salt": 0
    }
  }'
```

## Water

```bash
curl -X POST https://bodydashboard.de/api/integrations/openclaw/water \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{ "date": "2026-07-02", "amountMl": 500 }'
```

## Weight

```bash
curl -X POST https://bodydashboard.de/api/integrations/openclaw/weight \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bdoc_..." \
  -d '{ "date": "2026-07-02", "weightKg": 84.2, "bodyFatPercent": 18.5, "muscleMassKg": 62.1 }'
```

All body metric fields are optional, but at least one of `weightKg`, `bodyFatPercent`, or `muscleMassKg` must be present.
