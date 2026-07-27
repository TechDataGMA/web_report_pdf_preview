# web_report_pdf_preview

Print preview for Odoo PDF reports.

Out of the box, Odoo renders a `qweb-pdf` report server side and streams it back
with a `Content-Disposition: attachment` header: the file lands in the browser
downloads, and the only way to look at it is to open it from there. This module
inserts a preview step: the pdf is displayed in a dialog, using the pdf.js viewer
already shipped with Odoo, with **Print** and **Download** buttons.

- Supported version: Odoo 19.0
- License: AGPL-3

## How it works

The web client exposes a registry for that exact purpose,
`ir.actions.report handlers`, which `action_service.js` walks through before
falling back on the download. This module registers one handler that:

1. asks `/report/download` for the pdf, exactly like the standard flow does
   (same route, same payload, so wizard options, `active_ids`, multi-company
   context and `print_report_name` all keep working);
2. keeps the response as a blob and opens it in
   `/web/static/lib/pdfjs/web/viewer.html`;
3. prints or saves that same blob, so **the report is never rendered twice**.

Anything the handler does not take care of is handed back to the standard flow,
which keeps its own behaviour, including the fallback to the html version of the
report when wkhtmltopdf is missing or broken.

## What is left untouched

- `qweb-html` and `qweb-text` reports.
- Reports sent to an IoT printer (`iot`): those are printed, not previewed.
- Flows that do not go through an `ir.actions.report` action, such as the
  "Send & Print" wizard of invoices, which downloads the attachments it built.

## Disabling the preview for one action

Add `disable_pdf_preview` to the context of the report action:

```python
return report.report_action(records, config=False).update({
    "context": {**self.env.context, "disable_pdf_preview": True},
})
```

## Tests

The suite is a hoot suite, run in a headless browser:

```shell
COMMAND="-d preview --test-enable --test-tags /web_report_pdf_preview -i web_report_pdf_preview --stop-after-init" \
    docker compose run --rm --shm-size=2g web
```

It can also be run interactively from
`/web/tests?filter=web_report_pdf_preview`.
