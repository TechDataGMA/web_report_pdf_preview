// Copyright 2026 gmaOCR
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { queryAllTexts, queryOne } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";

import { browser } from "@web/core/browser/browser";
import { downloadFile } from "@web/core/network/download";
import { ActionMenus } from "@web/search/action_menus/action_menus";

class Foo extends models.Model {
    _name = "foo";

    name = fields.Char();

    _records = [{ id: 1, name: "First record" }];
}

class IrActionsReport extends models.Model {
    _name = "ir.actions.report";

    /** Of the two reports bound to `foo`, only the first one is a pdf. */
    get_pdf_preview_reports() {
        return [
            {
                id: 1,
                name: "Pdf report",
                report_name: "foo.pdf_report",
                report_file: "foo.pdf_report",
            },
        ];
    }
}

defineModels([Foo, IrActionsReport]);

describe.current.tags("desktop");

const PRINT_ITEMS = [
    { id: 1, name: "Pdf report", type: "ir.actions.report" },
    { id: 2, name: "Html report", type: "ir.actions.report" },
];

/**
 * Answers `/report/download` with a fake pdf, and lets every other route go
 * through the mocked network of the test suite.
 */
function mockReportDownload({ contentType = "application/pdf", status = 200 } = {}) {
    const originalFetch = browser.fetch;
    patchWithCleanup(browser, {
        fetch: (route, params) => {
            if (route !== "/report/download") {
                return originalFetch(route, params);
            }
            expect.step("/report/download");
            expect(params.method).toBe("POST");
            return new Response(new Blob(["%PDF-1.4 dummy"]), {
                status,
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": "attachment; filename*=UTF-8''Pdf%20report.pdf",
                },
            });
        },
    });
}

/** Records the native print path instead of running it. */
function stepNativePrint() {
    patchWithCleanup(ActionMenus.prototype, {
        executeAction(action) {
            expect.step(`native print ${action.id}`);
        },
    });
}

async function openPrintMenu() {
    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: { action: [], print: PRINT_ITEMS },
        loadActionMenus: true,
        arch: `<list><field name="name"/></list>`,
    });
    await contains("thead .o_list_record_selector input").click();
    await contains(".o_cp_action_menus .dropdown-toggle:eq(0)").click();
}

beforeEach(() => {
    onRpc("has_group", () => true);
});

test("a preview entry is added next to each pdf report", async () => {
    await openPrintMenu();

    expect(queryAllTexts(".o-dropdown--menu .o-dropdown-item")).toEqual([
        "Pdf report",
        "Preview: Pdf report",
        "Html report",
    ]);
});

test("the preview entry opens the dialog without printing", async () => {
    mockReportDownload();
    stepNativePrint();
    await openPrintMenu();

    await contains(".o-dropdown--menu .o-dropdown-item:contains(Preview)").click();
    await animationFrame();

    expect(".o_dialog .o_report_pdf_preview").toHaveCount(1);
    expect(".o_dialog header .modal-title").toHaveText("Pdf report");
    // The test framework moves `t-att-src` to `t-att-data-src` on iframes so that
    // they never hit the network (see tests/_framework/mock_templates.hoot.js).
    expect(queryOne(".o_dialog iframe").getAttribute("data-src")).toMatch(
        /^\/web\/static\/lib\/pdfjs\/web\/viewer\.html\?file=blob/
    );
    // Only the preview render: the print action was not executed.
    expect.verifySteps(["/report/download"]);
});

test("the native print entry is left untouched", async () => {
    mockReportDownload();
    stepNativePrint();
    await openPrintMenu();

    await contains(".o-dropdown--menu .o-dropdown-item:eq(0)").click();
    await animationFrame();

    expect(".o_dialog").toHaveCount(0);
    expect.verifySteps(["native print 1"]);
});

test("the download button reuses the previewed pdf", async () => {
    mockReportDownload();
    patchWithCleanup(downloadFile, {
        _download: (data, filename, mimetype) => {
            expect(data).toBeInstanceOf(Blob);
            expect(filename).toBe("Pdf report.pdf");
            expect(mimetype).toBe("application/pdf");
            expect.step("saved");
        },
    });
    await openPrintMenu();

    await contains(".o-dropdown--menu .o-dropdown-item:contains(Preview)").click();
    await animationFrame();
    await contains(".o_dialog footer button:contains(Download)").click();

    // A single /report/download: the pdf is not rendered again by the server.
    expect.verifySteps(["/report/download", "saved"]);
});

test("a report that cannot be rendered falls back on the print flow", async () => {
    mockReportDownload({ contentType: "text/html", status: 500 });
    stepNativePrint();
    await openPrintMenu();

    await contains(".o-dropdown--menu .o-dropdown-item:contains(Preview)").click();
    await animationFrame();

    expect(".o_dialog").toHaveCount(0);
    expect.verifySteps(["/report/download", "native print 1"]);
});
