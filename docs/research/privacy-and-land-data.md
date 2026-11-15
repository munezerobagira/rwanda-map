# Rwanda privacy and land-data handling

Sources accessed 2026-11-14. This documents concrete handling choices and gaps;
it does not certify legal compliance or turn a public endpoint into permission.

## Primary legal evidence

- Rwanda Law Nº 058/2021 of 13/10/2021, Official Gazette 15/10/2021, from the
  [Data Protection & Privacy Office](https://dpo.gov.rw/fileadmin/DPO/Law_relating_to_the_protection_of_personal_data_and_privacy.pdf).
  DPO's [official explanation](https://dpo.gov.rw/faqs) includes identifiable
  location information within personal data and explains controller/processor
  registration, representation and transfer/storage obligations. Do not assume
  public geospatial information can never become personal when linked to a person.
- [DPO processing and quality provisions](https://dpo.gov.rw/dpp-law/processing-and-quality-of-personal-data)
  inform purpose limitation, accuracy and minimization choices.
- The National Land Authority's [2022 land-registration Ministerial Order](https://www.lands.rw/fileadmin/user_upload/LANDS/Publications/Orders/Ministerial/Iteka_rya_Minisitiri_ryerekeye_iyandikishwa_ry_ubutaka.pdf)
  distinguishes access to basic information from detailed information supplied
  to owners or people/organs with legal credentials. App scope deliberately
  excludes owners, title searches, UPI/parcel identifiers and personal records.

## Controls in this implementation

1. OSM ingestion retains numeric source object IDs, point coordinates, footprint
   area and broad building-use class only. It drops contributor IDs/names,
   changesets, owner/contact/address tags. A fixture verifies private tags cannot
   survive. Geofabrik public extracts already omit contributor identity fields.
2. No land registry, parcel ownership, transaction identity, SPARC pilot records,
   names/addresses, face/person imagery analytics or individual profiling.
   Public-looking SPARC service was rejected after its explicit confidentiality
   restriction was found in item metadata. Schema was inspected, records were not.
3. Runtime building analysis reads public, immutable local snapshots. Request
   geometry is processed for a result, not saved in an application database;
   no POST body is logged by application code. Results aggregate counts and
   expose public building representative points, not people or households.
4. Date/version/method/low-confidence caveats prevent mapping coverage and
   experimental classification ranges from masquerading as official population,
   ownership or cadastral facts. Unknowns are not automatically houses.
5. Language preference is stored locally. Optional device geolocation remains
   user initiated through browser permission. Existing shareable URL includes
   map center and selection coordinates: users control whether they share it,
   but it can be precise and must not be described as anonymous/no-location-data.
6. Imagery catalog requests use a broad national bbox, not a person's location.
   OSM/EOX tile requests expose browser IP and referer to their providers; server
   hosting may log HTTP requests. No analytics account or user profile added.

## Deployment and future-work gaps

Confirm actual hosting/log retention/access and any cross-border handling with
the operator before public production claims; current testing is local and no
new deployment occurred. Do not claim that lack of an app database eliminates
hosting logs or all controller obligations. Keep optional correction/price input
behind a design/privacy review until there is a retention, consent/other lawful
basis, moderation and deletion process. Future price reports must not collect
owner identity, phone numbers or title documents. Historical public map snapshot
retention is not permission to retain personal submissions indefinitely.

The existing boundary dataset still lacks source/license/effective-date evidence;
this is a separate open-data rights blocker. A CC-BY World Bank alternative has
been found but has different coverage and needs a reviewed migration.

Drawn geometry checkpoint (2026-11-14): input is rounded to five decimal degrees
(~metre scale; not survey precision), bounded to 64 corners/50km² and used only
for shared selection analysis/exports. No owner/name fields or persistent server
store added. Geometry-sharing uses URL fragment rather than query parameters;
ordinary HTTP requests/referrers omit it. A copied address still discloses that
geometry; the inspector says so. Existing map-center/admin-selection query
coordinates remain an acknowledged URL/log privacy gap. Server/hosting logs and
GDPR/Rwanda obligations still require deployment-specific review.
