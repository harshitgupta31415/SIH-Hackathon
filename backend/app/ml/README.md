# Jal Jeevan Swasthya early-warning logic

## What the system solves

Water-borne disease outbreaks are often noticed only after many patients reach
a health facility. Jal Jeevan Swasthya gives district teams an earlier signal by
combining community disease reports, water-quality findings, village profiles,
and recent case trends.

## Current inference flow

1. A volunteer or health worker submits a geolocated disease report.
2. The backend checks the user's district and stores the report.
3. The forecast engine groups historical reports by village and disease,
   zero-fills missing calendar days, and forecasts the next 14 days.
4. The district prediction combines village forecasts with contaminated-water
   and population-exposure signals into a risk score.
5. `/api/dashboard/predictions/{district}/{disease}` returns the forecast,
   confidence, risk drivers, recommended actions, and village-level details.
6. A block officer or district administrator reviews the result and may create
   a response alert. The forecast never publishes an alert automatically.

## Model choices

- `forecast.py` uses a lightweight Holt/SES time-series ensemble when enough
  observations exist, and a clearly labelled heuristic fallback otherwise.
- `train.py` contains an optional Random Forest experiment for engineered
  features. It is not a clinical model and must only be promoted after
  time-based evaluation beats the baseline.
- Confidence is a data-sufficiency signal, not a guarantee that an outbreak
  will occur.

## Production validation required

Before using this outside a pilot, collect de-identified, verified historical
data across seasons; use strictly time-ordered train/test splits; compare MAE,
alert recall, false-alert rate, and uncertainty coverage against a seasonal
baseline; and monitor drift after deployment. Jal Jeevan Swasthya is decision support,
not diagnosis or autonomous public-health policy.
