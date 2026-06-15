# RTF's Inspection Problem — Plain English


---


## The core problem: the equipment isn't in the system

A fire inspection is fundamentally about equipment — this sprinkler riser, that
backflow preventer, these 18 devices in this building. ServiceTrade has a place
to store each piece of equipment as a record (make, model, serial number,
location in the building). When those records exist, ServiceTrade can do useful
things automatically — like printing the equipment onto the inspection form
before the tech even arrives.

RTF's equipment records are almost entirely empty. Verified, live:

- **5,317 buildings. Only 906 have any equipment records at all — about 17%.**
- Of the equipment that does exist, **72% is backflow devices**, and only because
  a county portal forced RTF to enter them.
- Their biggest service line, sprinkler, has **essentially zero**. There are
  **20 fire pump records in the entire company.**

---

## Why that's a problem

Because the equipment isn't in the system, every useful automation ServiceTrade
offers is dead on arrival:

- The inspection forms can't pre-fill.
- The new "Inspections" module RTF is being pushed to buy at renewal **literally
  cannot run** without equipment records.
- The techs are stuck doing by hand the thing the software was built to do.

---

## What they currently do instead

This is the workaround they've lived on for years:

A tech gets assigned an inspection. The form shows up blank. So the tech pulls
**last year's report** — saved as a PDF in Dropbox — copies it, deletes last
year's readings, keeps the equipment list, fills in this year's numbers, saves
it back to Dropbox for next year, and uploads a copy to ServiceTrade as a plain
PDF attachment labeled "Job Paperwork."

That happens across **~790 completed jobs a month.**

The key finding: **RTF never uses ServiceTrade's digital form feature.** Confirmed
— there are **zero completed task instances and zero active task lists in the
entire account** (that's the data ServiceTrade's form engine would create). All
of RTF's inspection data lives in flat PDF attachments. The bar for improving on
what they do today is low, because they aren't using the sophisticated tooling
at all.

---

## Why the equipment doesn't just load itself

Two reasons, both verified:

1. **There's no tool that does it.** ServiceTrade can *use* equipment records but
   has no feature that reads RTF's history and *creates* them. Its newest tool
   (Smart Scan) only captures equipment going forward — a tech photographs a
   nameplate on a future visit. Covering 5,000+ buildings that way would take
   years, and it's a paid upgrade. Nobody sells "read your old reports into
   records."

2. **Even RTF's own forms can't help.** Their 21 inspection forms were built in
   PowerPoint and saved as PDFs. In that process the form fields got meaningless
   computer-generated names ("Check Box 23"). So even the data techs *do* type
   stays locked inside documents nothing can read.

---

## How the equipment actually gets loaded

The data isn't missing — it's sitting in years of report PDFs, written down every
year by the techs. The path:

1. **Read the equipment details out of the archived reports.** Discovery: **73% of
   those PDFs were filled out digitally and are still machine-readable** — the
   values can be read directly, no guesswork. The rest are scans and need AI
   extraction.
2. **Load that equipment into ServiceTrade's records.**
3. **Rebuild the 21 forms cleanly** so their fields have proper names ServiceTrade
   recognizes.

After that, ServiceTrade itself handles the daily work — nothing new runs in the
background.

---

## What we proved

Not theory — watched it happen in their account: created one equipment record
through ServiceTrade, hit Print on a job, and ServiceTrade automatically filled
that equipment's make, model, serial, and location onto the inspection form.
That closes the loop: **load the records → the forms fill themselves.**

---

## Two checksums we found for free

- **82% of their recurring services encode the device count in the description**
  ("(18) Backflow Inspection"). So each building's extracted equipment can be
  checked against what RTF expects — and where the count is stale, RTF is
  **under-billing** (they charge per device). The data cleanup doubles as a
  revenue audit.
- **30% of inspection visits cover multiple disciplines** in one job (sprinkler +
  alarm + backflow together), which is why the customer packets get complex and
  why one person assembles them by hand.

---

## Open questions for the Dawn interview

Two things we have a confirmed core on but can't fully answer from the data alone:

1. **Which ServiceTrade features does the office staff touch daily?** Confirmed in
   use: job management, invoicing, recurrence scheduling, Parts Manager, the
   accounting connector to ComputerEase, Invoice Link Payments. Confirmed *not*
   used: digital inspection forms, Service Timecard, Tap to Pay, Service Portal.
   Gap: "daily" is inferred from data volume — nobody has watched the office work.

2. **How do AHJ (Authority Having Jurisdiction) reports get produced and
   submitted?** There are two form families: RTF's own forms (sprinkler, alarm)
   and AHJ-imposed forms that vary by jurisdiction (e.g. the City of Monroe's own
   backflow form, which is *not* one of the 21). Submission splits across BSI (a
   national backflow portal), individual city portals, and at least one county
   that's still paper + mailed check, with the office hand-entering each and
   processing fees. Gap: we know the pieces, not the full per-jurisdiction
   choreography. This is the highest-value thing to get from Dawn.
