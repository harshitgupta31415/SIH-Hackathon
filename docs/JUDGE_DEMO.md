# Three-minute judge demo

## Opening: the problem (20 seconds)

"In rural communities, diarrhoea and contaminated-water signals are often
recorded separately. HealthWatch turns those scattered field signals into an
early warning before a district-wide outbreak response is delayed."

## Field workflow (60 seconds)

1. Sign in as `rahul@healthwatch.gov.in` / `volunteer123`.
2. Open **New Report**, select a village, disease, symptoms, case count, and
   water source. Use the location button to demonstrate consent-based village
   selection.
3. Sign in as `priya@healthwatch.gov.in` / `worker123` and open **Water
   Quality** to record a local test.
4. Open **Risk Map** to show the backend has turned submitted records into
   village risk points.

## Intelligence and response (75 seconds)

1. Sign in as `admin@healthwatch.gov.in` / `admin123`.
2. Open **Outbreak Intelligence** in the sidebar.
3. Change the disease selector. Explain the visible chain: reports + water
   tests + village profile -> 14-day forecast -> risk drivers -> recommended
   action.
4. Point out the confidence and data-maturity labels. Say that the system is
   transparent about data limitations and requires human approval.
5. Click **Create response alert**, then open **Alerts** to show the action
   reached the operational response workflow.

## Close (25 seconds)

"This is not an autonomous diagnosis tool. It gives local health officials an
explainable, auditable early-warning signal and a faster route from field data
to a verified response."

## Judge questions to expect

- **Why ML?** Time-series forecasting identifies changes earlier than a static
  report count; the model must outperform a simple seasonal baseline.
- **How do you prevent harm?** District-bound access, role-gated alerts,
  human approval, confidence/data-maturity labels, and no automatic public
  alert.
- **What is next?** Pilot with verified de-identified data, add rainfall and
  laboratory integrations, validate time-based accuracy, and monitor drift.
