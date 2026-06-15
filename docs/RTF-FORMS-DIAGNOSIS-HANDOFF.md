# Why the Inspection Forms Keep Breaking, and What Fixing Them Unlocks

**Prepared for:** RTF Fire (Dan, Max, Alyson)
**Date:** June 2026
**Scope of this document:** the 21 blank paperwork templates in your ServiceTrade account

---

## What we examined

All 21 blank paperwork PDFs currently live in your ServiceTrade account
(the forms your technicians print or generate on every job). We downloaded
each one and analyzed how it was built: page structure, every form field,
field naming, and the software that created it. The raw analysis is on file
and reproducible.

## What we found

| Finding | The numbers |
|---|---|
| Built in PowerPoint | 15 of 21 (plus one Word file, one Publisher file, one scanned document, one print-to-PDF) |
| Header auto-fill wired | All 21 have the 8 to 10 ServiceTrade merge fields that fill in the customer name, address, and job number. This part works today. |
| Meaningless field names | Riser report: 249 of its 269 fields have auto-generated names like Text1 and Check Box23. Monthly and weekly pump reports: 125 of 136. Main inspection report: 121 of 236. Flow tampers: 121 of 134. |

## Why the forms have been tricky: the real mechanics

When a form is built in PowerPoint, exported to PDF, and run through
Acrobat's automatic field detection, Acrobat invents names for every blank:
Text1, Check Box23, 47. That is what happened here, on nearly every form.
Three consequences follow, and your team has been living with all of them:

**1. Every edit re-rolls the dice.**
Change one line in PowerPoint and re-export, and Acrobat re-detects the
fields with new arbitrary names and slightly shifted positions. This is the
drift-and-bloat cycle your office knows well. Nobody can make a small change
to these forms safely, which is why nobody wants to touch them.

**2. The header is the only part anyone could afford to wire up.**
The customer-name and job-number auto-fill works because someone, at some
point, hand-renamed those fields one at a time in Acrobat. That tedious work
has to be redone every time a form drifts. Hand-renaming the other 200-plus
fields per form was never going to happen.

**3. A completed form is a data graveyard.**
When a technician checks Check Box23, no system on earth can know that meant
relief valve opened at proper pressure. The inspection data exists, digitally,
and is still unreadable. This is why a person has to read every report with
their eyes before it can be reviewed, combined, invoiced, or delivered.

## The capability you already pay for that has never been used

ServiceTrade's paperwork engine is capable of pre-filling far more than the
header: customer details, job details, and full equipment data, down to the
serial number and last inspection date of an individual backflow device or
the motor on a fire pump. Across the platform there are several thousand
distinct pieces of information it can place onto paperwork automatically.

Your forms today use 8 to 10 of them. We have traced exactly why this
capability has never worked in your account; the short version is that the
forms and the underlying records both have to be prepared in a specific,
interlocking way, and neither half was ever done. The result is that your
technicians copy equipment data by hand from old reports on every single
inspection, and have for years.

## What rebuilding the forms the right way unlocks

The fix is not cosmetic, and it is not another round of editing in Acrobat.
Each form is rebuilt on a managed foundation so the PDF itself is never
hand-edited again.

- **Drift ends permanently.** Layout changes no longer move, rename, or
  break the fields. The forms stop degrading every time someone touches them.
- **Equipment sections fill themselves.** The rebuilt forms are wired so
  that once your equipment records are in place, paperwork arrives with the
  device data already printed. Technicians stop copying from old PDFs.
- **Completed forms become readable data.** A submitted report can be
  checked for completeness the moment it arrives, missing readings get
  caught before the customer sees them, and deficiencies can be pulled out
  automatically. The review burden on the office shrinks from everything to
  exceptions.
- **The fire alarm side joins the same system.** The FAI report pair is in
  this set. Rebuilding them brings the alarm side, currently reported
  through Excel, into the same structured pipeline as sprinkler.

The same rebuilt form pays off twice: once in the field (less typing, fewer
errors) and once in the office (machine-checkable reports).

## What this means for your September renewal

You told us you expect ServiceTrade to push the Inspections module into your
tier at renewal, at a meaningful price increase. Before forming an opinion on
that module, we verified how it actually works, in your own account.

The finding: **the Inspections module is built around equipment records.**
Its digital checklists attach to individual pieces of equipment, and an
inspection is generated by walking the equipment list for a location. We
checked your account directly: the checklist system sits completely empty,
and the equipment records it depends on do not exist. Across roughly 1,400
locations, your account contains about ten real equipment records.

Two conclusions follow:

**1. As your account stands today, the module cannot function.** Whatever
its merits, paying more for it buys nothing until the equipment foundation
exists. If the renewal conversation includes pressure to adopt it, this fact
belongs on your side of the table: you would be paying a premium for a
feature that is structurally inoperable in your account, and the vendor is
in a position to know that.

**2. Every path forward runs through the same first step.** Adopt their
module someday? It needs your equipment records loaded first. Modernize the
forms you already use? The automatic pre-fill needs the same records. Do
nothing? Your technicians keep hand-copying equipment data from old reports.
There is no version of the next three years in which loading your equipment
data into ServiceTrade is wasted work. It is the one investment that pays
off regardless of which way September goes, which is why it anchors the
proposal that accompanies this document.

A note on the vendor's likely response: ServiceTrade now sells an AI tool
that builds equipment records from nameplate photos taken by technicians as
they visit sites. It is a good tool, and it is also a multi-year path across
roughly 1,400 locations on annual inspection cycles, available only on their
higher pricing tiers. It complements a proper data foundation; it is not a
substitute for one.

**If you do evaluate the Inspections module, two demo requests will tell
you everything.** The original reason you walked away was that the generated
reports were enormous and could not be trimmed. Our research into the 2025
relaunch found genuine improvements (one app instead of two, faster forms,
automatic deficiency capture) but no public evidence that report length and
format are now under the customer's control. So in any sales conversation,
ask them to show you, live:

1. A four-page customer summary produced from an NFPA 25 annual inspection.
2. A report template being edited by an account user, without a paid
   ServiceTrade services engagement.

If they can do both, the module deserves a fresh look (on a loaded asset
foundation). If they cannot, the reason you said no the first time is still
true, whatever the new brochure says.

## Proof this works, already in your sandbox

Five of the 21 forms have been rebuilt this way: backflow, riser, fire pump,
fire hydrant, and the main inspection report. They are live in your
ServiceTrade demo account on job #43540754, including a per-job backflow form
that arrives with the location, job number, and technician already printed on
it. The method, the generator, and the upload pipeline all exist and have
been tested end to end against your real account.

## Remaining scope

Sixteen forms remain, in three complexity grades:

- **Simpler (5):** confined space pair, five-year internal pipe, FAI report,
  new customer info
- **Medium (6):** deficiency report pair, dry pipe valve trip test, standpipe
  test, hydrant flow test, work order
- **Heavier, with reading grids (5):** diesel, monthly, and weekly pump
  reports (likely one shared schema), fire extinguisher inspection
  (241 fields), and the remaining grid work on the inspection report

Each form gets a verification pass against the original with someone at RTF
who knows the forms, so nothing the technicians rely on is lost in the
rebuild. Pricing and sequencing are covered in the accompanying proposal.
