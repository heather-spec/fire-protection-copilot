import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  WorkStatusBadge,
  DeficiencyStatusBadge,
  SeverityBadge,
} from "@/components/dashboard/status-pill";
import {
  getActiveOrg,
  getSite,
  listAssetsForSite,
  listDeficienciesForSite,
  listSiteContacts,
  listWorkRecordsForSite,
} from "@/lib/db/queries";
import { addSiteContactAction, removeSiteContactAction } from "@/lib/actions/sites";
import { formatDate, titleCase } from "@/lib/utils/format";

export default async function SiteDetailPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const site = await getSite(active.org.id, params.id);
  if (!site) notFound();

  const [contacts, assets, records, defs] = await Promise.all([
    listSiteContacts(active.org.id, site.id),
    listAssetsForSite(active.org.id, site.id),
    listWorkRecordsForSite(active.org.id, site.id),
    listDeficienciesForSite(active.org.id, site.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={site.name}
        description={[site.city, site.state].filter(Boolean).join(", ") || "Site detail"}
        actions={
          <>
            <Link
              href={`/sites/${site.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
            <Link
              href={`/work-records/new?site=${site.id}&customer=${site.customer_id}`}
              className={buttonVariants({ size: "sm" })}
            >
              + New work record
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Site info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Customer">
              {site.customer ? (
                <Link className="hover:underline" href={`/customers/${site.customer.id}`}>
                  {site.customer.name}
                </Link>
              ) : "—"}
            </Row>
            <Row label="Address">
              {[site.address_line1, site.address_line2, site.city, site.state, site.postal_code]
                .filter(Boolean).join(", ") || "—"}
            </Row>
            <Row label="Occupancy">{site.occupancy_type ?? "—"}</Row>
            <Row label="Square footage">{site.square_footage?.toLocaleString() ?? "—"}</Row>
            <Row label="Jurisdiction">
              {site.jurisdiction ? (
                <div className="space-y-0.5">
                  <div>
                    <span className="font-medium">{site.jurisdiction.name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">({site.jurisdiction.state})</span>
                  </div>
                  {site.jurisdiction.adopted_code ? (
                    <div className="text-xs text-muted-foreground">{site.jurisdiction.adopted_code}</div>
                  ) : null}
                </div>
              ) : site.ahj ? site.ahj : "—"}
            </Row>
            {site.notes ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                <p className="mt-1 whitespace-pre-wrap">{site.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contacts</CardTitle>
            <span className="text-xs text-muted-foreground">{contacts.length}</span>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts yet. Add the on-site facilities lead so techs know who to find.
              </p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        {c.role ? <Badge variant="outline">{c.role}</Badge> : null}
                        {c.is_primary ? <Badge variant="secondary">Primary</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {c.notes ? <p className="mt-1 text-xs">{c.notes}</p> : null}
                    </div>
                    <form action={removeSiteContactAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="site_id" value={site.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label="Remove contact">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={addSiteContactAction} className="grid gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
              <input type="hidden" name="site_id" value={site.id} />
              <Field label="Name" htmlFor="c_name" required>
                <Input id="c_name" name="name" required />
              </Field>
              <Field label="Role" htmlFor="c_role">
                <Input id="c_role" name="role" placeholder="Facilities manager" />
              </Field>
              <Field label="Email" htmlFor="c_email">
                <Input id="c_email" name="email" type="email" />
              </Field>
              <Field label="Phone" htmlFor="c_phone">
                <Input id="c_phone" name="phone" />
              </Field>
              <Field label="Notes" htmlFor="c_notes" className="sm:col-span-2">
                <Input id="c_notes" name="notes" />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="is_primary" />
                Primary contact
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add contact
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Work records ({records.length})</CardTitle>
          <Link href={`/work-records/new?site=${site.id}&customer=${site.customer_id}`} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            + New work record
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No work records for this site yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tech</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/work-records/${r.id}`}>{r.reference_code ?? "—"}</Link>
                    </TableCell>
                    <TableCell>{titleCase(r.record_type)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.technician?.full_name ?? "—"}</TableCell>
                    <TableCell><WorkStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.completed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Deficiencies ({defs.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {defs.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No deficiencies on file.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" href={`/deficiencies/${d.id}`}>{d.title}</Link>
                      </TableCell>
                      <TableCell><SeverityBadge severity={d.severity} /></TableCell>
                      <TableCell><DeficiencyStatusBadge status={d.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Assets ({assets.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {assets.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No assets tagged for this site.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mfr / model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.identifier ?? "—"}</TableCell>
                      <TableCell>{titleCase(a.asset_type)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[a.manufacturer, a.model].filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
