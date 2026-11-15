# ADR 0011 — Count comparison independent of imagery

2026-11-15. User reports building/house comparison not working and requests both
comparison and non-comparison modes, while using Esri reference imagery.

Observed URL has no analysis flag. Analysis defaulted off, its action was hidden
in the layer dock and styled as permanently unavailable. Esri hid the timeline
until analysis was enabled. Live tests on the user's village return0 mapped
structures for both dates, while the earlier cell returns300 vs285; these are
mapped-source tallies, not actual house counts. A coverage gap is a second cause
of an apparently broken feature and must not become an invented house estimate.

Compare (1) retaining the opt-in dock-only flow and imagery period form on Esri,
(2) automatically analyze eligible selected areas with a visible inspector toggle,
explicit one-date/two-date count mode and available source dates independent of
basemap. Choose2. Respect explicit off state in shared links. Oversized selections
must explain the limit and never fire a guaranteed-invalid analysis request.

Reuse TimelineScrubber: imagery retains the existing interval/swipe controls;
reference basemaps show count-date controls with immediate updates and the same
A/B state. Switching comparison off sends one date and removes delta/second-date
points/rows from the shared result and exports. Available source dates are shown
so two requests resolving to one snapshot cannot look like a failed comparison.
Zero mapped data show no available house estimate. Continue open coverage-source
work; never manufacture houses or derive ML datasets from Esri imagery.

Acceptance: actual user village/cell one-date and two-date APIs, populated control
rendering on Esri and explicit off/reload URL tests, same selection across modes,
rw/en/fr, combined exports, lint/types/build. Actual browser click/touch tests
remain blocked while the supplied browser access host is unavailable.
