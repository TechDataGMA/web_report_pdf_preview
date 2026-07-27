# web_report_pdf_preview

Print preview for Odoo PDF reports.

Odoo renders a `qweb-pdf` report server side and streams it back with a
`Content-Disposition: attachment` header: the file lands in the browser downloads
and the only way to look at it is to open it from there. This module adds a
**Preview** entry next to each pdf report of the Print menu. It displays the
report in a dialog, using the pdf.js viewer already shipped with Odoo, with
**Print** and **Download** buttons.

- Supported version: Odoo 19.0
- License: AGPL-3

## How it works

The printing flow itself is **not modified**: the native entries of the Print
menu keep downloading the pdf exactly as before. The module only adds entries:

1. `ActionMenus.loadAvailablePrintItems` is patched to append a `Preview: <report>`
   entry after each pdf report of the dropdown. Reports hidden from the user by
   their groups, by the access rights of the model or by their binding domain are
   filtered out by Odoo before the patch runs, so a preview entry only ever
   appears next to a report the user can already print.
2. Clicking it asks `/report/download` for the pdf, exactly like the print flow
   does (same route, same payload, so `active_ids`, multi-company context and
   `print_report_name` keep working), and keeps the response as a blob.
3. Printing or saving from the dialog reuses that blob, so **the report is never
   rendered twice**.

If the pdf cannot be rendered (wkhtmltopdf missing or broken, error raised by the
report), the preview hands the report over to the standard print flow, which
reports the error and degrades to the html version of the report.

Report definitions are only readable by `group_system`, so the list of pdf
reports comes from `ir.actions.report.get_pdf_preview_reports`, which builds on
`get_bindings` and therefore inherits its group and access-rights filtering.

## Where the entry appears

In the Print dropdown of the control panel, in every view (list, form, kanban)
and for every model that has pdf reports.

It does **not** appear for prints that do not go through that dropdown, which
keep their native behaviour:

- report buttons hard-coded in a view (`<button type="action" name="%(report)d"/>`);
- prints driven by a wizard, such as "Send & Print" for invoices;
- reports sent to an IoT printer.

## Tests

The suite is a hoot suite, run in a headless browser:

```shell
DB="test_web_report_pdf_preview_$(date +%s)"
docker compose run --rm web odoo -d "$DB" -i web_report_pdf_preview \
    --test-enable --test-tags /web_report_pdf_preview/tests/test_js.py --stop-after-init
docker compose exec -T db dropdb -U odoo --if-exists "$DB"
```

It can also be run interactively from `/web/tests?filter=web_report_pdf_preview`.
